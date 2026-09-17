/**
 * The single write path into stock.
 *
 * Exactly one method changes a quantity or a reservation, and it does four things inside one
 * transaction: it resolves the level row, locks it, validates the domain invariants against the
 * locked values, and writes one append-only ledger row beside the level update. The level tables are
 * a cache of the ledger, so the two can never be written apart — which is what makes reconciliation
 * a comparison the engine can act on rather than a repair of two numbers that were written apart.
 *
 * Concurrency is handled at the row: Postgres and MySQL take a `SELECT ... FOR UPDATE` on the level
 * row, SQLite relies on its single writer, and the update itself is a compare-and-set on the
 * optimistic-lock counter so a lost update is detected instead of silently overwriting. A contention
 * loss is retried three times with increasing backoff and then refused with `STOCK_CONFLICT`.
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { DatabaseTypeEnum } from '@gauzy/config';
import { Product, RequestContext, WarehouseProduct, WarehouseProductVariant } from '@gauzy/core';
import { StockMovement } from './../stock-movement/stock-movement.entity';
import { StockMovementType } from './../inventory.enums';
import { InventoryErrorCode, invariantViolation, inventoryError } from './../inventory.errors';
import {
	IAppliedMovement,
	IStockAvailability,
	IStockLevelCorrection,
	IStockMovementInput,
	IStockReconciliation,
	IStockReconciliationFilter
} from './stock-level.types';

/** Retry schedule of the compare-and-set on a contended level row, in milliseconds. */
const RETRY_BACKOFF_MS = [20, 60, 180];

/** Default time a caller waits for the level row lock before the write is refused. */
const DEFAULT_LOCK_TIMEOUT_MS = 5000;

/** Types that change the on-hand quantity. The rest are reservation-only. */
const RESERVATION_ONLY_TYPES: StockMovementType[] = [
	StockMovementType.RESERVATION,
	StockMovementType.RELEASE
];

/**
 * The movement input as the engine reads it.
 *
 * The movement contract carries the change, its cause and the document that cites it. A caller may
 * state one thing more: the backorder policy it wants applied to *this* call, which is how the
 * reservation contract’s per-call override reaches the rule that evaluates a hold. It is read from
 * the input rather than declared on it because it qualifies the caller’s intent for one movement and
 * not the movement itself, and it is honoured in place of the level’s column only when stated.
 */
type TStockMovementInput = IStockMovementInput & { allowBackorder?: boolean };

/**
 * A level row as a reconciliation reads it.
 *
 * The location of a level is a column of the aggregate it hangs from, so the row carries it under the
 * join’s own name — `warehouseId` — with the prefixed spelling the platform’s query builders fall back
 * to when a joined column is named apart from the root entity.
 */
type TReconcilableLevel = WarehouseProductVariant & { warehouseId?: ID; __aggregate_warehouseId?: ID };

/**
 * The single write path into stock, and the reads that answer from it.
 *
 * The atomicity this engine owes the domain — one ledger row, one level update and one aggregate
 * delta inside one transaction, under a row lock, with the reservation guard evaluated against the
 * locked values — is expressed once, against the platform’s relational connection. Writing it twice,
 * once per ORM, is how the two copies would drift and how one installation would end up with a weaker
 * guard than another; the entity repositories serve the read paths and entity loading, and every
 * quantity change funnels through here.
 *
 * The reads it serves are the availability lookups and the reconciliation, which is why a stock level
 * is a resource of its own over REST and over GraphQL rather than a number reached through whatever
 * document last moved it.
 */
@Injectable()
export class StockLevelService {
	private readonly logger = new Logger(StockLevelService.name);

	constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

	/**
	 * Writes exactly one ledger row and updates the level row in a single transaction.
	 *
	 * The movement belongs to the caller’s unit of work whenever the caller has one. A document that
	 * writes a movement — a dispatch, a receipt, a manual correction, a cycle count, a hold — writes it
	 * beside its own row, and the two are one write or neither: passing the transaction the caller is
	 * already inside is what makes a failure after the movement take the movement back with it. Opening
	 * a second transaction here instead would commit the movement on its own connection, and the
	 * caller’s rollback would then leave a ledger row and a level that no document explains.
	 *
	 * A caller with no transaction of its own gets one: the engine is usable on its own, and the
	 * atomicity it owes — one ledger row, one level update and one aggregate delta together — is then
	 * its own to provide.
	 *
	 * @param input the signed delta, its cause and the document that carries it.
	 * @param manager the transaction to join, when the caller is already inside one.
	 * @returns the persisted movement and the level state it produced.
	 */
	public async applyMovement(
		input: IStockMovementInput,
		manager?: EntityManager
	): Promise<IAppliedMovement> {
		const movement = input as TStockMovementInput;
		const quantityDelta = Number(movement.quantityDelta ?? 0);
		const reservedDelta = Number(movement.reservedDelta ?? 0);

		if (!Number.isFinite(quantityDelta) || !Number.isFinite(reservedDelta)) {
			throw inventoryError(InventoryErrorCode.INVARIANT_VIOLATION, 'A movement delta must be a finite number.', {
				badRequest: true
			});
		}
		if (!movement.referenceType || !movement.referenceId) {
			throw invariantViolation(
				'INV-12',
				'Every quantity change must name the document that caused it.',
				{ referenceType: movement.referenceType, referenceId: movement.referenceId }
			);
		}

		if (manager) {
			return await this.applyOn(manager, movement, quantityDelta, reservedDelta);
		}

		return await this.dataSource.transaction(
			async (transactional: EntityManager) =>
				await this.applyOn(transactional, movement, quantityDelta, reservedDelta)
		);
	}

	/**
	 * Applies one movement inside a transaction that is already open.
	 *
	 * The level row is resolved and locked first, so every invariant the write is measured against is
	 * read under the lock rather than before it.
	 *
	 * @param manager the open transaction.
	 * @param movement the movement as the engine reads it.
	 * @param quantityDelta the signed change to the on-hand quantity.
	 * @param reservedDelta the signed change to the held quantity.
	 * @returns the persisted movement and the level state it produced.
	 */
	private async applyOn(
		manager: EntityManager,
		movement: TStockMovementInput,
		quantityDelta: number,
		reservedDelta: number
	): Promise<IAppliedMovement> {
		const level = await this.resolveLevel(manager, movement);
		await this.lockLevelRow(manager, level.id, movement.lockTimeoutMs);

		return await this.applyWithRetry(manager, level.id, movement, quantityDelta, reservedDelta);
	}

	/**
	 * Derives the availability of one level row.
	 *
	 * Availability is never stored: a stored `availableQuantity` would be a third source of truth for
	 * one number and could drift from the two columns it is computed from.
	 */
	public toAvailability(level: WarehouseProductVariant, warehouseId: ID): IStockAvailability {
		const quantity = Number(level.quantity ?? 0);
		const reservedQuantity = Number(level.reservedQuantity ?? 0);
		const safetyStock = Number(level.safetyStock ?? 0);
		return {
			levelId: level.id,
			warehouseId,
			variantId: level.variantId,
			quantity,
			reservedQuantity,
			safetyStock,
			availableQuantity: quantity - reservedQuantity - safetyStock,
			incomingQuantity: Number(level.incomingQuantity ?? 0),
			isUnlimited: !!level.isUnlimited,
			allowBackorder: !!level.allowBackorder,
			backorderLimit: level.backorderLimit === null || level.backorderLimit === undefined
				? undefined
				: Number(level.backorderLimit)
		};
	}

	/**
	 * Reads the levels of a location, of a variant, or of a location and a variant.
	 *
	 * The location of a level row is reached through its product-level aggregate, which is why the
	 * query joins rather than filtering a column that does not exist on the level table. The rows are
	 * the caller’s own: a level of another tenant is not a level this caller may read, which is why the
	 * read is scoped to the tenant the request runs in.
	 */
	public async findLevels(filter: { warehouseId?: ID; variantId?: ID; take?: number }): Promise<IStockAvailability[]> {
		const query = this.levelRead().limit(filter.take ?? 100);

		if (filter.warehouseId) {
			query.andWhere('aggregate.warehouseId = :warehouseId', { warehouseId: filter.warehouseId });
		}
		if (filter.variantId) {
			query.andWhere('level.variantId = :variantId', { variantId: filter.variantId });
		}
		this.scopeToTenant(query);

		const rows = await query.getMany();
		return (rows as any[]).map((row) =>
			this.toAvailability(row as WarehouseProductVariant, row.warehouseId ?? row.__aggregate_warehouseId)
		);
	}

	/**
	 * Reads one level row by its id, or null when no level holds it.
	 *
	 * This is the read a resource route answers with: the level is addressed by its id there, and its
	 * location comes from the aggregate it hangs from rather than from the caller.
	 */
	public async findLevelById(id: ID): Promise<IStockAvailability | null> {
		const query = this.levelRead().where('level.id = :id', { id });
		this.scopeToTenant(query);

		const row = await query.getOne();
		if (!row) {
			return null;
		}
		const level = row as any;
		return this.toAvailability(level as WarehouseProductVariant, level.warehouseId ?? level.__aggregate_warehouseId);
	}

	/** Reads one level row, or null when the variant is not stocked at that location. */
	public async findLevel(warehouseId: ID, variantId: ID): Promise<IStockAvailability | null> {
		const query = this.levelRead()
			.where('aggregate.warehouseId = :warehouseId', { warehouseId })
			.andWhere('level.variantId = :variantId', { variantId });
		this.scopeToTenant(query);

		const level = await query.getOne();
		return level ? this.toAvailability(level, warehouseId) : null;
	}

	/**
	 * Availability of a variant at a location. A variant that is not stocked there has none, which is
	 * a different answer from zero on hand.
	 */
	public async availableQuantity(warehouseId: ID, variantId: ID): Promise<number> {
		const level = await this.findLevel(warehouseId, variantId);
		return level ? level.availableQuantity : 0;
	}

	/**
	 * Puts the level rows back in agreement with the movement ledger.
	 *
	 * The ledger is the truth and the level tables are its cache, so a level whose `quantity` is not
	 * the sum of its own movements is corrected to that sum. The correction is written to the level row
	 * under a compare-and-set on the version it read, and the report names every level it moved
	 * together with the numbers that decided it.
	 *
	 * Why the correction is not written as a movement: a movement is applied to *both* sides of the
	 * invariant — it moves the level row and it adds its own quantity to the sum it is compared
	 * against — so `level − ledger` is unchanged by any movement, and a level the ledger disagrees with
	 * cannot be brought back into agreement by one. Writing a correcting movement would therefore leave
	 * exactly as much drift as it found and would walk the level further away on every run. The one
	 * input that can close the gap is the ledger itself, so that is what the level row is set from.
	 *
	 * The lock and the compare-and-set are what keep a concurrent movement from being overwritten: the
	 * row lock is taken *before* the level is read, so the value being replaced is one no other writer
	 * can move while this correction is computed, and the write is still predicated on the version it
	 * read. A level that already agrees with its ledger is not written at all — the report says so by
	 * leaving it out, which is what makes a second run report nothing.
	 *
	 * The whole run is one transaction, so a failure partway through leaves the levels as they were
	 * rather than a half-corrected set, and every correction moves the aggregate its level hangs from by
	 * the same delta, so a product-level row stays the sum of its variant rows.
	 *
	 * @param filter which level rows the run walks, and how many.
	 * @returns what the run scanned and what it corrected, with the numbers that decided each one.
	 */
	public async reconcile(filter: IStockReconciliationFilter = {}): Promise<IStockReconciliation> {
		const take = Number.isFinite(filter.take) ? Number(filter.take) : 200;

		return await this.dataSource.transaction(async (manager: EntityManager) => {
			const levels = await this.levelsToReconcile(manager, filter, take);
			const corrections: IStockLevelCorrection[] = [];

			for (const level of levels) {
				const warehouseId = level.warehouseId ?? level.__aggregate_warehouseId;
				if (!warehouseId) {
					continue;
				}

				// The row lock is taken before the level is read, so the quantity being replaced is one
				// no concurrent movement can move while this correction is computed.
				await this.lockLevelRow(manager, level.id, filter.lockTimeoutMs);
				const locked = await manager.findOne(WarehouseProductVariant, { where: { id: level.id } });
				const quantityBefore = Number(locked?.quantity ?? 0);
				const ledgerQuantity = await this.ledgerQuantityOf(manager, warehouseId, level.variantId);

				if (ledgerQuantity === quantityBefore) {
					continue;
				}

				await this.correctLevel(manager, locked ?? level, quantityBefore, ledgerQuantity);

				corrections.push({
					levelId: level.id,
					warehouseId,
					variantId: level.variantId,
					quantityBefore,
					ledgerQuantity,
					quantityAfter: ledgerQuantity
				});
			}

			return { scanned: levels.length, corrected: corrections.length, corrections };
		});
	}

	/*
	|--------------------------------------------------------------------------
	| Internals
	|--------------------------------------------------------------------------
	*/

	/**
	 * The joined level read every availability lookup builds.
	 *
	 * The location of a level row is a property of the product-level aggregate it belongs to, so the
	 * join is stated once here rather than repeated by each read with a chance to drift.
	 */
	private levelRead() {
		return this.dataSource.manager
			.createQueryBuilder(WarehouseProductVariant, 'level')
			.innerJoin('level.warehouseProduct', 'aggregate')
			.select(['level.id', 'level.variantId', 'level.quantity', 'level.reservedQuantity'])
			.addSelect([
				'level.safetyStock',
				'level.incomingQuantity',
				'level.isUnlimited',
				'level.allowBackorder',
				'level.backorderLimit',
				'aggregate.warehouseId'
			]);
	}

	/**
	 * Narrows a level read to the tenant the request runs in.
	 *
	 * A caller with no tenant — a worker, a migration, a system context — is not narrowed: those reads
	 * are the platform’s own and span every tenant by design.
	 */
	private scopeToTenant(query: any): void {
		const tenantId = RequestContext.currentTenantId();
		if (tenantId) {
			query.andWhere('level.tenantId = :tenantId', { tenantId });
		}
	}

	/**
	 * The level rows a reconciliation walks: the caller’s tenant, the requested location and variant,
	 * at most a batch of them.
	 */
	private async levelsToReconcile(
		manager: EntityManager,
		filter: IStockReconciliationFilter,
		take: number
	): Promise<TReconcilableLevel[]> {
		const query = manager
			.createQueryBuilder(WarehouseProductVariant, 'level')
			.innerJoin('level.warehouseProduct', 'aggregate')
			.select(['level.id', 'level.variantId', 'level.warehouseProductId', 'level.quantity'])
			.addSelect(['level.version', 'level.tenantId', 'aggregate.warehouseId'])
			.limit(take);

		if (filter.warehouseId) {
			query.andWhere('aggregate.warehouseId = :warehouseId', { warehouseId: filter.warehouseId });
		}
		if (filter.variantId) {
			query.andWhere('level.variantId = :variantId', { variantId: filter.variantId });
		}
		this.scopeToTenant(query);

		return (await query.getMany()) as TReconcilableLevel[];
	}

	/**
	 * Sums a level’s movement ledger.
	 *
	 * The sum is the number the level row is supposed to hold: the level tables are a cache of the
	 * ledger, and every quantity change is one row of it.
	 */
	private async ledgerQuantityOf(manager: EntityManager, warehouseId: ID, variantId: ID): Promise<number> {
		const raw = await manager
			.createQueryBuilder(StockMovement, 'movement')
			.select('COALESCE(SUM(movement.quantity), 0)', 'total')
			.where('movement.warehouseId = :warehouseId', { warehouseId })
			.andWhere('movement.variantId = :variantId', { variantId })
			.getRawOne();

		return Number(raw?.total ?? 0);
	}

	/**
	 * Writes one level row to the quantity its ledger sums to, under the version it was read at.
	 *
	 * The write is a compare-and-set — `UPDATE … SET quantity = ?, version = version + 1 WHERE id = ?
	 * AND version = ?` — so a level another writer moved between the read and this statement is refused
	 * rather than overwritten, exactly like every other write to a level row. The aggregate the level
	 * hangs from takes the same delta, so a product-level row stays the sum of its variant rows.
	 *
	 * Nothing is written to the movement ledger here. The ledger is the input of this correction, not
	 * its output: a movement moves the level and the sum it is compared against by the same quantity,
	 * so a correcting movement would leave the drift it was meant to close exactly where it was.
	 *
	 * @param manager the transaction the run holds.
	 * @param level the level row as it was read under its lock.
	 * @param quantityBefore the quantity the level held when the correction was computed.
	 * @param ledgerQuantity the sum of the level’s movements, which is what it is corrected to.
	 * @throws ConflictException When the row moved past the version this correction was computed from.
	 */
	private async correctLevel(
		manager: EntityManager,
		level: WarehouseProductVariant,
		quantityBefore: number,
		ledgerQuantity: number
	): Promise<void> {
		const version = Number(level.version ?? 1);
		const update = await manager
			.createQueryBuilder()
			.update(WarehouseProductVariant)
			.set({ quantity: ledgerQuantity, version: version + 1 })
			.where('id = :id AND version = :version', { id: level.id, version })
			.execute();

		if (!update.affected) {
			throw inventoryError(
				InventoryErrorCode.CONFLICT,
				'The stock level is contended: the correction was computed from a version another writer has moved.',
				{ details: { levelId: level.id, version, attempts: 1 } }
			);
		}

		// The delta is taken from the quantity the correction was computed against rather than from the
		// row the write just produced, so the aggregate moves by exactly what the level moved by.
		await this.applyAggregateDelta(manager, level, ledgerQuantity - quantityBefore, 0);
	}

	/**
	 * Resolves the level row of a `(location, variant)` pair, creating it with the documented defaults
	 * when the variant has never been stocked at that location.
	 *
	 * A level row is addressed by `(location, variant)` — the pair the movement always carries — and
	 * that pair is resolved first. The row standing there is the ordinary case, and it is the level's
	 * own product that the movement is recorded against, so a caller that cares only about the variant
	 * does not have to state a product at all. A product the caller *does* state is a claim about which
	 * product's level the movement belongs to; a claim the level contradicts is a real conflict and is
	 * refused rather than written against a row of another product.
	 *
	 * A product is genuinely required for the one case that has nothing to take it from: a level that
	 * does not exist yet has to be created, and the product-level aggregate row it hangs from is what
	 * names it. That product is not unknowable, though — a variant belongs to exactly one product, and
	 * the variant table states which — so a movement that stocks a variant at a location for the first
	 * time is answered with the variant’s own product. A caller that states a product has answered it
	 * already, and a statement the variant contradicts is refused rather than written against either
	 * reading: the two name two different stock items.
	 */
	private async resolveLevel(
		manager: EntityManager,
		input: TStockMovementInput
	): Promise<WarehouseProductVariant> {
		if (input.levelId) {
			const byId = await manager.findOne(WarehouseProductVariant, { where: { id: input.levelId } });
			if (!byId) {
				throw inventoryError(
					InventoryErrorCode.LEVEL_NOT_FOUND,
					'The stock level named by the movement does not exist.',
					{ notFound: true, details: { levelId: input.levelId } }
				);
			}
			await this.assertLevelHoldsProduct(manager, byId, input.productId);
			return byId;
		}

		const existing = await this.findLevelRow(manager, input.warehouseId, input.variantId);
		if (existing) {
			await this.assertLevelHoldsProduct(manager, existing, input.productId);
			return existing;
		}

		const aggregate = await this.resolveAggregate(manager, input.warehouseId, input.productId, input.variantId);

		// A level row is created with the documented defaults, never with a caller-supplied quantity:
		// the opening quantity arrives as the movement that is being applied right now.
		const created = manager.create(WarehouseProductVariant, {
			warehouseProductId: aggregate.id,
			variantId: input.variantId,
			quantity: 0,
			reservedQuantity: 0,
			incomingQuantity: 0,
			safetyStock: 0,
			allowBackorder: false,
			trackInventory: true,
			isUnlimited: false,
			version: 1
		} as any);
		return await manager.save(WarehouseProductVariant, created);
	}

	/**
	 * Reads the level row standing at a location for a variant.
	 *
	 * The location is a property of the product-level aggregate the level row belongs to, so the read
	 * joins through it rather than filtering a column the level table does not have — the same read the
	 * public availability lookups use.
	 */
	private async findLevelRow(
		manager: EntityManager,
		warehouseId: ID,
		variantId: ID
	): Promise<WarehouseProductVariant | null> {
		return await manager
			.createQueryBuilder(WarehouseProductVariant, 'level')
			.innerJoin('level.warehouseProduct', 'aggregate')
			.where('aggregate.warehouseId = :warehouseId', { warehouseId })
			.andWhere('level.variantId = :variantId', { variantId })
			.getOne();
	}

	/**
	 * Refuses a movement whose stated product is not the product the level belongs to.
	 *
	 * The check is skipped when the caller stated no product, because the movement is then addressed
	 * by the level it resolved and there is nothing to disagree with. A caller that stated one is
	 * answered with the conflict rather than with a write against a row it did not mean: the two
	 * readings name two different levels, and picking one of them silently is how a quantity lands on
	 * the wrong product.
	 */
	private async assertLevelHoldsProduct(
		manager: EntityManager,
		level: WarehouseProductVariant,
		productId?: ID
	): Promise<void> {
		if (!productId || !level.warehouseProductId) {
			return;
		}

		const aggregate = await manager.findOne(WarehouseProduct, { where: { id: level.warehouseProductId } });
		if (aggregate && aggregate.productId && String(aggregate.productId) !== String(productId)) {
			throw invariantViolation(
				'INV-01',
				'The level at this location holds another product, so the movement cannot be recorded against the product it names.',
				{
					warehouseId: aggregate.warehouseId,
					level: {
						id: level.id,
						variantId: level.variantId,
						productId: aggregate.productId,
						statedProductId: productId
					}
				}
			);
		}
	}

	/**
	 * Resolves the product-level aggregate row that owns the level row of a first-time stock, creating
	 * it when the product has never been stocked at that location.
	 *
	 * This runs only for a level that does not exist yet, which is why the product has to be resolved
	 * here: the aggregate row is what gives the new level its product, and a movement that stocks a
	 * variant at a location for the first time is the one movement that cannot be addressed by the
	 * level it is about.
	 *
	 * The product a caller states is the product the movement claims to be about, and the variant’s own
	 * product is what the variant says it is. The two agreeing is the ordinary case. The caller stating
	 * nothing is answered with the variant’s product, because a variant belongs to exactly one product
	 * and a level of that variant cannot hold another — the product is therefore knowable without the
	 * caller, and demanding it would refuse a receipt into a location that has simply never stocked the
	 * variant before. The caller stating something the variant contradicts is a real conflict between
	 * two readings of the same stock item, and it is refused rather than resolved in favour of either.
	 *
	 * @param manager The transaction the movement runs in.
	 * @param warehouseId The location of the first-time stock.
	 * @param productId The product the caller stated, when it stated one.
	 * @param variantId The variant the movement is about, which owns the product when none is stated.
	 */
	private async resolveAggregate(
		manager: EntityManager,
		warehouseId: ID,
		productId?: ID,
		variantId?: ID
	): Promise<WarehouseProduct> {
		const statedProductId = productId;
		const variantProductId = variantId ? await this.productOf(manager, variantId) : undefined;
		const resolvedProductId = statedProductId ?? variantProductId;

		if (!resolvedProductId) {
			throw invariantViolation(
				'INV-01',
				'A level row is addressed by its product, so the movement must carry the product id.',
				{ warehouseId }
			);
		}

		const existing = await manager.findOne(WarehouseProduct, {
			where: { warehouseId, productId: resolvedProductId }
		});

		// The product has to exist before anything is decided about it: a movement for a product that is
		// not there is a missing product, which is a different answer from a disagreement with the variant.
		const product = await manager.findOne(Product, { where: { id: resolvedProductId } });
		if (!product) {
			throw inventoryError(InventoryErrorCode.LEVEL_NOT_FOUND, 'The product named by the movement does not exist.', {
				notFound: true,
				details: { productId: resolvedProductId }
			});
		}

		// And a stated product is checked against the variant *before* an aggregate of that product is
		// resolved: a location that already stocks the product the caller named must not take a movement
		// for a variant that belongs to another one, which is what an unresolved disagreement would do.
		if (statedProductId && variantProductId && String(statedProductId) !== String(variantProductId)) {
			throw invariantViolation(
				'INV-01',
				'The variant belongs to another product, so the movement cannot be recorded against the product it names.',
				{ warehouseId, variantId, productId: resolvedProductId, statedProductId, variantProductId }
			);
		}

		if (existing) {
			return existing;
		}

		const created = manager.create(WarehouseProduct, {
			warehouseId,
			productId: resolvedProductId,
			quantity: 0,
			reservedQuantity: 0,
			incomingQuantity: 0,
			safetyStock: 0,
			allowBackorder: false,
			trackInventory: true,
			isUnlimited: false,
			version: 1,
			tenantId: product.tenantId,
			organizationId: product.organizationId
		} as any);
		return await manager.save(WarehouseProduct, created);
	}

	/**
	 * Reads the product a variant belongs to.
	 *
	 * The ledger row carries the variant’s product as a denormalised reference, and the variant table is
	 * where that answer lives — the same read the manual-correction and cycle-count paths make when they
	 * hand the engine the product of the variant they are correcting.
	 *
	 * @param manager The transaction the read runs in.
	 * @param variantId The variant to read.
	 * @returns The product of the variant, or undefined when the variant names none.
	 */
	private async productOf(manager: EntityManager, variantId: ID): Promise<ID | undefined> {
		const raw: Array<{ productId?: ID }> = await manager.query(
			'SELECT "productId" FROM "product_variant" WHERE "id" = $1',
			[variantId]
		);
		return raw && raw[0] ? raw[0].productId : undefined;
	}

	/**
	 * Locks the level row for the duration of the transaction.
	 *
	 * SQLite has a single writer, so the transaction itself is the lock and there is nothing to take.
	 */
	private async lockLevelRow(manager: EntityManager, levelId: ID, timeoutMs?: number): Promise<void> {
		const dialect = manager.connection.options.type as DatabaseTypeEnum;
		const timeout = Number.isFinite(timeoutMs) ? Number(timeoutMs) : DEFAULT_LOCK_TIMEOUT_MS;

		if (dialect === DatabaseTypeEnum.postgres) {
			await manager.query('SET LOCAL lock_timeout = $1', [`${timeout}ms`]);
			await manager.query('SELECT "id" FROM "warehouse_product_variant" WHERE "id" = $1 FOR UPDATE', [levelId]);
			return;
		}
		if (dialect === DatabaseTypeEnum.mysql) {
			await manager.query('SET SESSION innodb_lock_wait_timeout = ?', [Math.ceil(timeout / 1000)]);
			await manager.query('SELECT `id` FROM `warehouse_product_variant` WHERE `id` = ? FOR UPDATE', [levelId]);
			return;
		}
		// SQLite (and better-sqlite3) serialise writers at the database level.
	}

	/**
	 * Applies one movement against an already-locked level row, retrying the compare-and-set when a
	 * competing writer won the row between the read and the update.
	 *
	 * The order inside one attempt is the property the ledger rests on: the level is read, the state it
	 * would reach is computed and validated, the level is written **under a compare-and-set**, and the
	 * ledger row that records the change is written only once that write is known to have won. An
	 * attempt that loses the row therefore leaves nothing behind at all — the movement it computed is
	 * discarded with the attempt — so however many retries a contended write takes, the ledger holds
	 * exactly one row per logical movement and the level stays the sum of its movements.
	 */
	private async applyWithRetry(
		manager: EntityManager,
		levelId: ID,
		input: TStockMovementInput,
		quantityDelta: number,
		reservedDelta: number,
		attempt = 0
	): Promise<IAppliedMovement> {
		const level = await manager.findOne(WarehouseProductVariant, { where: { id: levelId } });
		if (!level) {
			throw inventoryError(InventoryErrorCode.LEVEL_NOT_FOUND, 'The stock level disappeared during the write.', {
				notFound: true,
				details: { levelId }
			});
		}

		const quantityBefore = Number(level.quantity ?? 0);
		const reservedBefore = Number(level.reservedQuantity ?? 0);
		const quantityAfter = quantityBefore + quantityDelta;
		const reservedAfter = reservedBefore + reservedDelta;

		this.assertInvariants(input.type, level, quantityAfter, reservedAfter, input.allowBackorder);

		const binId = await this.resolveBin(manager, input);

		const version = Number(level.version ?? 1);
		const update = await manager
			.createQueryBuilder()
			.update(WarehouseProductVariant)
			.set({
				quantity: quantityAfter,
				reservedQuantity: reservedAfter,
				version: version + 1
			})
			.where('id = :id AND version = :version', { id: level.id, version })
			.execute();

		if (!update.affected) {
			const backoff = RETRY_BACKOFF_MS[attempt];
			if (backoff === undefined) {
				throw inventoryError(
					InventoryErrorCode.CONFLICT,
					'The stock level is contended: three attempts to write it were overtaken by another writer.',
					{ details: { levelId: level.id, attempts: RETRY_BACKOFF_MS.length } }
				);
			}
			this.logger.warn(`Retrying a contended level write on ${level.id} after ${backoff}ms.`);
			await this.sleep(backoff + Math.floor(Math.random() * backoff));
			return await this.applyWithRetry(manager, levelId, input, quantityDelta, reservedDelta, attempt + 1);
		}

		// The level is this writer's. Only now is the ledger row that explains it written, inside the
		// same transaction, so the two are never apart: an attempt that lost the compare-and-set never
		// reaches this line, and an attempt that won it always records its movement exactly once.
		const movement = manager.create(StockMovement, {
			warehouseId: input.warehouseId,
			warehouseProductVariantId: level.id,
			warehouseProductId: level.warehouseProductId,
			variantId: input.variantId,
			binId,
			type: input.type,
			quantity: quantityDelta,
			quantityBefore,
			quantityAfter,
			reservedBefore,
			reservedAfter,
			referenceType: input.referenceType,
			referenceId: input.referenceId,
			reason: input.reason,
			note: input.note,
			occurredAt: input.occurredAt ?? new Date(),
			createdByUserId: input['createdByUserId']
		} as any);
		const persisted = await manager.save(StockMovement, movement);

		await this.applyAggregateDelta(manager, level, quantityDelta, reservedDelta);

		return {
			movementId: persisted.id,
			levelId: level.id,
			quantityBefore,
			quantityAfter,
			reservedBefore,
			reservedAfter,
			binId
		};
	}

	/**
	 * Validates the domain invariants of a movement against the locked level state.
	 *
	 * Two rules, and both are evaluated for every movement rather than for a subset of types. A
	 * reservation-only movement leaves the on-hand quantity where it was, so the quantity rule is
	 * satisfied by construction; but the hold rule is exactly the one a pure reservation can break,
	 * and skipping it there would be skipping it where it matters most. The engine exists to make
	 * overselling impossible, so the check is unconditional and reads the values it took under the
	 * row lock.
	 *
	 * The backorder policy is the level’s own unless the caller stated one for this call, in which case
	 * that is what the hold is measured against — the override exists so a caller that has decided a
	 * demand may be backordered is not refused by the column it is overriding. The limit the policy
	 * states still comes from the level, because a per-call override loosens the policy, it does not
	 * grant a policy the level never configured.
	 */
	private assertInvariants(
		type: StockMovementType,
		level: WarehouseProductVariant,
		quantityAfter: number,
		reservedAfter: number,
		allowBackorderOverride?: boolean
	): void {
		const allowBackorder = allowBackorderOverride ?? !!level.allowBackorder;
		const isUnlimited = !!level.isUnlimited;
		const levelDetail = { id: level.id, type, quantityAfter, reservedAfter };

		if (reservedAfter < 0) {
			throw invariantViolation('INV-07', 'Reserved quantity must never become negative.', {
				level: levelDetail
			});
		}

		if (quantityAfter < 0 && !isUnlimited) {
			throw invariantViolation('INV-05', 'On-hand quantity must never become negative on a tracked level.', {
				level: levelDetail
			});
		}

		if (reservedAfter > quantityAfter && !isUnlimited) {
			if (!allowBackorder) {
				throw invariantViolation(
					'INV-07',
					'A hold may not exceed the on-hand quantity on a level that does not allow backorder.',
					{ level: levelDetail }
				);
			}
			const limit =
				level.backorderLimit === null || level.backorderLimit === undefined
					? undefined
					: Number(level.backorderLimit);
			if (limit !== undefined && reservedAfter - quantityAfter > limit) {
				throw invariantViolation('INV-07', 'The hold would exceed the level’s backorder limit.', {
					level: { ...levelDetail, backorderLimit: limit }
				});
			}
		}
	}

	/**
	 * Resolves the physical address of the movement.
	 *
	 * A bin-addressed movement on a location that is not binned is refused rather than silently
	 * ignored, because the caller asked for an address the location cannot honour.
	 */
	private async resolveBin(manager: EntityManager, input: IStockMovementInput): Promise<ID | undefined> {
		if (!input.binId) {
			return undefined;
		}
		const rows: Array<{ warehouseId: string }> = await manager.query(
			'SELECT "warehouseId" FROM "warehouse_bin" WHERE "id" = $1',
			[input.binId]
		);
		const bin = rows && rows[0];
		if (!bin) {
			throw inventoryError(InventoryErrorCode.BIN_LOCATION_MISMATCH, 'The bin named by the movement does not exist.', {
				details: { binId: input.binId }
			});
		}
		if (bin.warehouseId !== input.warehouseId) {
			throw inventoryError(
				InventoryErrorCode.BIN_LOCATION_MISMATCH,
				'The bin named by the movement belongs to another location.',
				{ details: { binId: input.binId, warehouseId: input.warehouseId } }
			);
		}
		return input.binId;
	}

	/**
	 * Applies the same deltas to the product-level aggregate row, by delta and never by re-reading.
	 *
	 * A re-read and re-sum would be a second source of truth for the same number and would race with
	 * every concurrent writer on the location; the delta is applied inside the same transaction, so the
	 * aggregate is always the running sum of its variant rows.
	 */
	private async applyAggregateDelta(
		manager: EntityManager,
		level: WarehouseProductVariant,
		quantityDelta: number,
		reservedDelta: number
	): Promise<void> {
		if (!level.warehouseProductId) {
			return;
		}
		await manager
			.createQueryBuilder()
			.update(WarehouseProduct)
			.set({
				quantity: () => `"quantity" + ${quantityDelta}`,
				reservedQuantity: () => `"reservedQuantity" + ${reservedDelta}`
			})
			.where('id = :id', { id: level.warehouseProductId })
			.execute();
	}

	/** Waits, without blocking the event loop. */
	private async sleep(ms: number): Promise<void> {
		await new Promise((resolve) => setTimeout(resolve, ms));
	}
}
