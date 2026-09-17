/**
 * The single write path into stock.
 *
 * Exactly one method changes a quantity or a reservation, and it does four things inside one
 * transaction: it resolves the level row, locks it, validates the domain invariants against the
 * locked values, and writes one append-only ledger row beside the level update. The level tables are
 * a cache of the ledger, so the two can never be written apart — that is what makes the nightly
 * reconciliation a report rather than a repair.
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
import { Product, WarehouseProduct, WarehouseProductVariant } from '@gauzy/core';
import { StockMovement } from './../stock-movement/stock-movement.entity';
import { StockMovementType } from './../inventory.enums';
import { InventoryErrorCode, invariantViolation, inventoryError } from './../inventory.errors';
import { IAppliedMovement, IStockAvailability, IStockMovementInput } from './stock-level.types';

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
 * The single write path into stock.
 *
 * The atomicity this engine owes the domain — one ledger row, one level update and one aggregate
 * delta inside one transaction, under a row lock, with the reservation guard evaluated against the
 * locked values — is expressed once, against the platform’s relational connection. Writing it twice,
 * once per ORM, is how the two copies would drift and how one installation would end up with a weaker
 * guard than another; the entity repositories serve the read paths and entity loading, and every
 * quantity change funnels through here.
 */
@Injectable()
export class StockLevelService {
	private readonly logger = new Logger(StockLevelService.name);

	constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

	/**
	 * Writes exactly one ledger row and updates the level row in a single transaction.
	 *
	 * @param input the signed delta, its cause and the document that carries it.
	 * @returns the persisted movement and the level state it produced.
	 */
	public async applyMovement(input: IStockMovementInput): Promise<IAppliedMovement> {
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

		return await this.dataSource.transaction(async (transactional: EntityManager) => {
			const level = await this.resolveLevel(transactional, movement);
			await this.lockLevelRow(transactional, level.id, movement.lockTimeoutMs);

			return await this.applyWithRetry(transactional, level.id, movement, quantityDelta, reservedDelta);
		});
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
	 * query joins rather than filtering a column that does not exist on the level table.
	 */
	public async findLevels(filter: { warehouseId?: ID; variantId?: ID; take?: number }): Promise<IStockAvailability[]> {
		const query = this.dataSource.manager
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
			])
			.limit(filter.take ?? 100);

		if (filter.warehouseId) {
			query.andWhere('aggregate.warehouseId = :warehouseId', { warehouseId: filter.warehouseId });
		}
		if (filter.variantId) {
			query.andWhere('level.variantId = :variantId', { variantId: filter.variantId });
		}

		const rows = await query.getMany();
		return (rows as any[]).map((row) =>
			this.toAvailability(row as WarehouseProductVariant, row.warehouseId ?? row.__aggregate_warehouseId)
		);
	}

	/** Reads one level row, or null when the variant is not stocked at that location. */
	public async findLevel(warehouseId: ID, variantId: ID): Promise<IStockAvailability | null> {
		const level = await this.dataSource.manager
			.createQueryBuilder(WarehouseProductVariant, 'level')
			.innerJoin('level.warehouseProduct', 'aggregate')
			.where('aggregate.warehouseId = :warehouseId', { warehouseId })
			.andWhere('level.variantId = :variantId', { variantId })
			.getOne();
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

	/*
	|--------------------------------------------------------------------------
	| Internals
	|--------------------------------------------------------------------------
	*/

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
	 * names it, so a movement that stocks a variant for the first time must say which product it is.
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

		const aggregate = await this.resolveAggregate(manager, input.warehouseId, input.productId);

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
	 * This runs only for a level that does not exist yet, which is why the product has to be named
	 * here: the aggregate row is what gives the new level its product, and a movement that stocks a
	 * variant at a location for the first time is the one movement that cannot be addressed by the
	 * level it is about.
	 */
	private async resolveAggregate(
		manager: EntityManager,
		warehouseId: ID,
		productId?: ID
	): Promise<WarehouseProduct> {
		let resolvedProductId = productId;
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
		if (existing) {
			return existing;
		}

		const product = await manager.findOne(Product, { where: { id: resolvedProductId } });
		if (!product) {
			throw inventoryError(InventoryErrorCode.LEVEL_NOT_FOUND, 'The product named by the movement does not exist.', {
				notFound: true,
				details: { productId: resolvedProductId }
			});
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
