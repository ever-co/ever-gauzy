import { Injectable } from '@nestjs/common';
import { FindManyOptions, IsNull } from 'typeorm';
import { ID, IPagination } from '@gauzy/contracts';
import { RequestContext, TenantAwareCrudService, WarehouseProductVariant } from '@gauzy/core';
import {
	StockCountLineStatus,
	StockCountMode,
	StockCountStatus,
	StockMovementReferenceType,
	StockMovementType,
	StockReasonCode
} from './../inventory.enums';
import { InventoryErrorCode, inventoryError } from './../inventory.errors';
import { InventorySequenceService } from './../inventory-sequence.service';
import { StockLevelService } from './../stock-level/stock-level.service';
import { StockCountLine } from './../stock-count-line/stock-count-line.entity';
import { StockCount } from './stock-count.entity';
import { TypeOrmStockCountRepository } from './repository/type-orm-stock-count.repository';
import { MikroOrmStockCountRepository } from './repository/mikro-orm-stock-count.repository';

/** States a session may be counted in. */
const COUNTABLE: StockCountStatus[] = [StockCountStatus.OPEN, StockCountStatus.COUNTING];

/** States a session may not be opened from, because it has already finished. */
const TERMINAL: StockCountStatus[] = [StockCountStatus.CLOSED, StockCountStatus.CANCELED];

/**
 * Opens, counts and closes physical count sessions.
 *
 * The closing step is the one that touches stock, and it does so through the ledger engine: one
 * correction per line whose counted quantity differs from what the record held, referencing the line
 * that produced it. A session that is closed is immutable, so the variance report a location signs
 * off on cannot change afterwards.
 */
@Injectable()
export class StockCountService extends TenantAwareCrudService<StockCount> {
	constructor(
		readonly typeOrmStockCountRepository: TypeOrmStockCountRepository,
		readonly mikroOrmStockCountRepository: MikroOrmStockCountRepository,
		private readonly sequenceService: InventorySequenceService,
		private readonly stockLevelService: StockLevelService
	) {
		super(typeOrmStockCountRepository, mikroOrmStockCountRepository);
	}

	/** Lists sessions. */
	public async findCounts(filter?: FindManyOptions<StockCount>): Promise<IPagination<StockCount>> {
		return await this.paginate(filter ?? {});
	}

	/**
	 * Creates a draft session and numbers it.
	 *
	 * At most one session per location may be in a non-terminal state. Two open sessions over the same
	 * shelves would each snapshot a different expectation and each write a correction, which is how a
	 * count turns into a correction war.
	 */
	public async createCount(input: Partial<StockCount>): Promise<StockCount> {
		return await this.typeOrmStockCountRepository.manager.transaction(async (manager) => {
			const open = await manager.findOne(StockCount, {
				where: {
					warehouseId: input.warehouseId,
					status: StockCountStatus.OPEN,
					tenantId: RequestContext.currentTenantId()
				} as any
			});
			if (open) {
				throw inventoryError(
					InventoryErrorCode.COUNT_ALREADY_OPEN,
					'A count session is already open for this location.',
					{ details: { stockCountId: open.id } }
				);
			}

			const { formatted } = await this.sequenceService.allocate('STOCK_COUNT');
			const count = manager.create(StockCount, {
				...input,
				number: formatted,
				status: StockCountStatus.DRAFT,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			} as Partial<StockCount>);
			return await manager.save(StockCount, count);
		});
	}

	/**
	 * Opens a session: the lines are generated from the scope and the expectation is snapshotted.
	 *
	 * The snapshot is taken now and never re-read, because the whole point of a count is to compare
	 * what the record believed at the start against what the floor reports at the end.
	 */
	public async open(id: ID): Promise<StockCount> {
		return await this.typeOrmStockCountRepository.manager.transaction(async (manager) => {
			const count = await this.requireState(manager, id, [StockCountStatus.DRAFT]);

			const levels = await manager
				.createQueryBuilder(WarehouseProductVariant, 'level')
				.innerJoin('level.warehouseProduct', 'aggregate')
				.where('aggregate.warehouseId = :warehouseId', { warehouseId: count.warehouseId })
				.getMany();

			for (const level of levels as WarehouseProductVariant[]) {
				const line = manager.create(StockCountLine, {
					stockCountId: count.id,
					variantId: level.variantId,
					warehouseProductVariantId: level.id,
					expectedQuantity: Number(level.quantity ?? 0),
					status: StockCountLineStatus.PENDING,
					binId: count.binId,
					tenantId: count.tenantId,
					organizationId: count.organizationId
				} as Partial<StockCountLine>);
				await manager.save(StockCountLine, line);
			}

			count.status = StockCountStatus.OPEN;
			count.startedAt = new Date();
			count.startedByUserId = RequestContext.currentUserId();
			return await manager.save(StockCount, count);
		});
	}

	/**
	 * Records counted quantities in one call, which is what makes a sheet one request rather than one
	 * request per line.
	 */
	public async recordLines(
		id: ID,
		lines: Array<{ lineId: ID; countedQuantity: number; note?: string }>
	): Promise<StockCount> {
		return await this.typeOrmStockCountRepository.manager.transaction(async (manager) => {
			const count = await this.requireState(manager, id, COUNTABLE);

			for (const input of lines) {
				const line = await manager.findOne(StockCountLine, { where: { id: input.lineId, stockCountId: id } });
				if (!line) {
					throw inventoryError(InventoryErrorCode.LEVEL_NOT_FOUND, 'The count line does not exist.', {
						notFound: true,
						details: { lineId: input.lineId }
					});
				}

				const counted = Number(input.countedQuantity);
				if (line.status === StockCountLineStatus.PENDING) {
					line.countedQuantity = counted;
					line.variance = counted - Number(line.expectedQuantity);
					line.status = StockCountLineStatus.COUNTED;
				} else {
					// A second reading of the same position is a recount, and the recount is what closes
					// the line. Keeping both readings is what makes the two counts comparable.
					line.recountedQuantity = counted;
					line.variance = counted - Number(line.expectedQuantity);
					line.status = StockCountLineStatus.RECOUNTED;
				}
				line.countedAt = new Date();
				line.countedByUserId = RequestContext.currentUserId();
				line.note = input.note ?? line.note;
				await manager.save(StockCountLine, line);
			}

			const all = await manager.find(StockCountLine, { where: { stockCountId: id } });
			count.countedLineCount = all.filter((line: StockCountLine) => line.countedQuantity !== null && line.countedQuantity !== undefined).length;
			count.varianceUnits = all.reduce(
				(total: number, line: StockCountLine) => total + Math.abs(Number(line.variance ?? 0)),
				0
			);
			if (count.status === StockCountStatus.OPEN) {
				count.status = StockCountStatus.COUNTING;
			}
			return await manager.save(StockCount, count);
		});
	}

	/**
	 * Closes a session and writes the ledger.
	 *
	 * One correction per counted line whose reading differs from what the record held. Lines nobody
	 * counted write nothing: a missing reading is not evidence that the stock is absent, and treating
	 * it as zero would write off the whole location.
	 */
	public async close(id: ID): Promise<{ count: StockCount; movements: ID[] }> {
		return await this.typeOrmStockCountRepository.manager.transaction(async (manager) => {
			const count = await this.requireState(manager, id, COUNTABLE);
			const lines = await manager.find(StockCountLine, { where: { stockCountId: id } });

			const movements: ID[] = [];
			for (const line of lines as StockCountLine[]) {
				const closing = line.recountedQuantity ?? line.countedQuantity;
				if (closing === null || closing === undefined) {
					line.status = StockCountLineStatus.SKIPPED;
					await manager.save(StockCountLine, line);
					continue;
				}

				const level = await manager.findOne(WarehouseProductVariant, { where: { id: line.warehouseProductVariantId } });
				const current = Number(level?.quantity ?? 0);
				const delta = Number(closing) - current;
				if (delta === 0) {
					continue;
				}

				// The correction joins this session's transaction: a later line that cannot be written
				// takes the corrections of the lines before it back with it, so closing a session is one
				// write or none.
				const applied = await this.stockLevelService.applyMovement(
					{
						warehouseId: count.warehouseId,
						variantId: line.variantId,
						productId: await this.productOf(manager, line.variantId),
						binId: line.binId,
						type: StockMovementType.COUNT,
						quantityDelta: delta,
						reservedDelta: 0,
						referenceType: StockMovementReferenceType.COUNT,
						referenceId: line.id,
						reason: StockReasonCode.CYCLE_COUNT,
						levelId: line.warehouseProductVariantId
					},
					manager
				);
				line.movementId = applied.movementId;
				line.variance = Number(closing) - Number(line.expectedQuantity);
				await manager.save(StockCountLine, line);
				movements.push(applied.movementId);
			}

			count.status = StockCountStatus.CLOSED;
			count.closedAt = new Date();
			count.closedByUserId = RequestContext.currentUserId();
			const saved = await manager.save(StockCount, count);
			return { count: saved, movements };
		});
	}

	/** Cancels a session without writing the ledger. */
	public async cancel(id: ID): Promise<StockCount> {
		return await this.typeOrmStockCountRepository.manager.transaction(async (manager) => {
			const count = await this.requireState(manager, id, [
				StockCountStatus.DRAFT,
				StockCountStatus.OPEN,
				StockCountStatus.COUNTING,
				StockCountStatus.REVIEW
			]);
			count.status = StockCountStatus.CANCELED;
			return await manager.save(StockCount, count);
		});
	}

	/** Lists the lines of a session, optionally hiding the expectation for a blind count. */
	public async listLines(id: ID, includeExpected: boolean): Promise<StockCountLine[]> {
		const lines = await this.typeOrmStockCountRepository.manager.find(StockCountLine, {
			where: { stockCountId: id }
		});
		if (includeExpected) {
			return lines;
		}
		return (lines as StockCountLine[]).map((line) => {
			const hidden = { ...line } as StockCountLine;
			delete (hidden as Partial<StockCountLine>).expectedQuantity;
			delete (hidden as Partial<StockCountLine>).variance;
			return hidden;
		});
	}

	/** Counts the lines still awaiting a reading, which is what a progress readout shows. */
	public async pendingLineCount(id: ID): Promise<number> {
		return await this.typeOrmStockCountRepository.manager.count(StockCountLine, {
			where: { stockCountId: id, countedQuantity: IsNull() } as any
		});
	}

	/*
	|--------------------------------------------------------------------------
	| Internals
	|--------------------------------------------------------------------------
	*/

	/** Loads a session and refuses an operation the state does not allow. */
	private async requireState(manager: any, id: ID, expected: StockCountStatus[]): Promise<StockCount> {
		const count = await manager.findOne(StockCount, { where: { id } });
		if (!count) {
			throw inventoryError(InventoryErrorCode.LEVEL_NOT_FOUND, 'The count session does not exist.', {
				notFound: true,
				details: { stockCountId: id }
			});
		}
		if (TERMINAL.includes(count.status)) {
			throw inventoryError(
				InventoryErrorCode.COUNT_ALREADY_CLOSED,
				`The count session is ${count.status} and a finished session is immutable.`,
				{ details: { stockCountId: id, status: count.status } }
			);
		}
		if (!expected.includes(count.status)) {
			throw inventoryError(
				InventoryErrorCode.COUNT_NOT_OPEN,
				`The count session is ${count.status}, which does not allow this operation.`,
				{ details: { stockCountId: id, status: count.status, expected } }
			);
		}
		return count;
	}

	/**
	 * Reads the product of a variant, which the ledger row needs for its denormalised reference.
	 *
	 * Read through the level service rather than as raw SQL: the `SELECT … WHERE "id" = $1` this method
	 * used to carry is a PostgreSQL placeholder, and the embedded dialect refused it with `RangeError: Too
	 * many parameter values were provided` the first time a count had to create a level.
	 */
	private async productOf(manager: any, variantId: ID): Promise<ID | undefined> {
		return this.stockLevelService.productOfVariant(manager, variantId);
	}
}
