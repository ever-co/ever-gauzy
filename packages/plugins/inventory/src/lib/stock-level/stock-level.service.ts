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
		const quantityDelta = Number(input.quantityDelta ?? 0);
		const reservedDelta = Number(input.reservedDelta ?? 0);

		if (!Number.isFinite(quantityDelta) || !Number.isFinite(reservedDelta)) {
			throw inventoryError(InventoryErrorCode.INVARIANT_VIOLATION, 'A movement delta must be a finite number.', {
				badRequest: true
			});
		}
		if (!input.referenceType || !input.referenceId) {
			throw invariantViolation(
				'INV-12',
				'Every quantity change must name the document that caused it.',
				{ referenceType: input.referenceType, referenceId: input.referenceId }
			);
		}

		return await this.dataSource.transaction(async (transactional: EntityManager) => {
			const level = await this.resolveLevel(transactional, input);
			await this.lockLevelRow(transactional, level.id, input.lockTimeoutMs);

			return await this.applyWithRetry(transactional, level.id, input, quantityDelta, reservedDelta);
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
	 */
	private async resolveLevel(
		manager: EntityManager,
		input: IStockMovementInput
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
			return byId;
		}

		const aggregate = await this.resolveAggregate(manager, input.warehouseId, input.productId);
		const existing = await manager.findOne(WarehouseProductVariant, {
			where: { warehouseProductId: aggregate.id, variantId: input.variantId, tenantId: input['tenantId'] }
		});
		if (existing) {
			return existing;
		}

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

	/** Resolves the product-level aggregate row that owns the level row. */
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
	 */
	private async applyWithRetry(
		manager: EntityManager,
		levelId: ID,
		input: IStockMovementInput,
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

		this.assertInvariants(input.type, level, quantityAfter, reservedAfter);

		const binId = await this.resolveBin(manager, input);

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

		// The rollback of this transaction removes the ledger row, so a failed level write can never
		// leave the ledger claiming a change the level did not receive.
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
	 */
	private assertInvariants(
		type: StockMovementType,
		level: WarehouseProductVariant,
		quantityAfter: number,
		reservedAfter: number
	): void {
		const allowBackorder = !!level.allowBackorder;
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
