import { Injectable } from '@nestjs/common';
import { FindManyOptions } from 'typeorm';
import { ID, IPagination } from '@gauzy/contracts';
import { RequestContext, TenantAwareCrudService, WarehouseProductVariant } from '@gauzy/core';
import { StockAdjustmentStatus, StockAdjustmentType, StockMovementType, StockMovementReferenceType } from './../inventory.enums';
import { InventoryErrorCode, inventoryError } from './../inventory.errors';
import { InventorySequenceService } from './../inventory-sequence.service';
import { StockLevelService } from './../stock-level/stock-level.service';
import { StockAdjustment } from './stock-adjustment.entity';
import { TypeOrmStockAdjustmentRepository } from './repository/type-orm-stock-adjustment.repository';
import { MikroOrmStockAdjustmentRepository } from './repository/mikro-orm-stock-adjustment.repository';

/**
 * Records and applies manual corrections.
 *
 * Applying an instruction is the only way a caller can move a quantity by hand, and it goes through
 * the ledger engine like every other change: one instruction, one movement, one level update, in one
 * transaction. The engine’s reservation guard is what stops an operator from writing off stock that
 * a customer is already holding.
 */
@Injectable()
export class StockAdjustmentService extends TenantAwareCrudService<StockAdjustment> {
	constructor(
		readonly typeOrmStockAdjustmentRepository: TypeOrmStockAdjustmentRepository,
		readonly mikroOrmStockAdjustmentRepository: MikroOrmStockAdjustmentRepository,
		private readonly sequenceService: InventorySequenceService,
		private readonly stockLevelService: StockLevelService
	) {
		super(typeOrmStockAdjustmentRepository, mikroOrmStockAdjustmentRepository);
	}

	/** Lists instructions. */
	public async findAdjustments(filter?: FindManyOptions<StockAdjustment>): Promise<IPagination<StockAdjustment>> {
		return await this.paginate(filter ?? {});
	}

	/**
	 * Drafts an instruction and numbers it.
	 *
	 * A manual correction must state why it happened; the reason code or the free-text reason satisfies
	 * that, and an instruction that names neither is refused before it reaches the database.
	 */
	public async createAdjustment(input: Partial<StockAdjustment>): Promise<StockAdjustment> {
		if (!input.reasonCode && !input.reason) {
			throw inventoryError(
				InventoryErrorCode.ADJUSTMENT_REASON_REQUIRED,
				'A manual correction must state a reason code or a reason.',
				{ badRequest: true }
			);
		}

		return await this.typeOrmStockAdjustmentRepository.manager.transaction(async (manager) => {
			const { formatted } = await this.sequenceService.allocate('STOCK_ADJUSTMENT');
			const adjustment = manager.create(StockAdjustment, {
				...input,
				number: formatted,
				status: StockAdjustmentStatus.DRAFT,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			} as Partial<StockAdjustment>);
			return await manager.save(StockAdjustment, adjustment);
		});
	}

	/**
	 * Applies a drafted instruction.
	 *
	 * The delta is derived from the instruction’s type and the level row it is applied against, which
	 * is why the instruction stores the observed target for a set rather than a pre-computed delta: the
	 * level may have moved between drafting and applying, and the correction must be the difference
	 * from what is actually there.
	 *
	 * The level it moves is written under the version the request accepted, so a caller that read the
	 * level and decided from it is refused when the level has moved since — and the version the write
	 * left behind is reported back, which is what lets the caller condition its next instruction.
	 */
	public async apply(id: ID): Promise<{ adjustment: StockAdjustment; quantityDelta: number; version?: number }> {
		return await this.typeOrmStockAdjustmentRepository.manager.transaction(async (manager) => {
			const adjustment = await manager.findOne(StockAdjustment, { where: { id } });
			if (!adjustment) {
				throw inventoryError(InventoryErrorCode.LEVEL_NOT_FOUND, 'The adjustment does not exist.', {
					notFound: true,
					details: { adjustmentId: id }
				});
			}
			if (adjustment.status !== StockAdjustmentStatus.DRAFT) {
				throw inventoryError(
					InventoryErrorCode.ADJUSTMENT_ALREADY_APPLIED,
					`The adjustment is already ${adjustment.status} and an applied instruction is immutable.`,
					{ details: { adjustmentId: id, status: adjustment.status } }
				);
			}

			const level = await this.findLevel(manager, adjustment.warehouseId, adjustment.variantId);
			const current = Number(level?.quantity ?? 0);
			const quantityDelta = this.resolveDelta(adjustment.type, Number(adjustment.quantity), current);
			let version: number | undefined;

			if (quantityDelta !== 0) {
				// The movement joins this instruction's transaction, so an instruction that fails to be
				// stamped as applied does not leave the correction it wrote behind.
				const applied = await this.stockLevelService.applyMovement(
					{
						warehouseId: adjustment.warehouseId,
						variantId: adjustment.variantId,
						productId: (await this.productOf(manager, adjustment.variantId)) as ID,
						type: StockMovementType.ADJUSTMENT,
						quantityDelta,
						reservedDelta: 0,
						referenceType: StockMovementReferenceType.ADJUSTMENT,
						referenceId: adjustment.id,
						reason: adjustment.reasonCode,
						note: adjustment.note,
						levelId: level?.id
					},
					manager
				);
				adjustment.movementId = applied.movementId;
				adjustment.warehouseProductVariantId = applied.levelId;
				version = applied.version;
			}

			adjustment.status = StockAdjustmentStatus.APPLIED;
			adjustment.appliedAt = new Date();
			adjustment.appliedByUserId = RequestContext.currentUserId();
			const saved = await manager.save(StockAdjustment, adjustment);
			return { adjustment: saved, quantityDelta, version };
		});
	}

	/** Cancels a drafted instruction without touching stock. */
	public async cancel(id: ID): Promise<StockAdjustment> {
		return await this.typeOrmStockAdjustmentRepository.manager.transaction(async (manager) => {
			const adjustment = await manager.findOne(StockAdjustment, { where: { id } });
			if (!adjustment) {
				throw inventoryError(InventoryErrorCode.LEVEL_NOT_FOUND, 'The adjustment does not exist.', {
					notFound: true,
					details: { adjustmentId: id }
				});
			}
			if (adjustment.status !== StockAdjustmentStatus.DRAFT) {
				throw inventoryError(
					InventoryErrorCode.ADJUSTMENT_ALREADY_APPLIED,
					'Only a drafted instruction can be cancelled.',
					{ details: { adjustmentId: id, status: adjustment.status } }
				);
			}
			adjustment.status = StockAdjustmentStatus.CANCELED;
			return await manager.save(StockAdjustment, adjustment);
		});
	}

	/*
	|--------------------------------------------------------------------------
	| Internals
	|--------------------------------------------------------------------------
	*/

	/** Derives the signed delta the instruction asks for. */
	private resolveDelta(type: StockAdjustmentType, stated: number, current: number): number {
		switch (type) {
			case StockAdjustmentType.INCREASE:
			case StockAdjustmentType.FOUND:
				return Math.abs(stated);
			case StockAdjustmentType.DECREASE:
			case StockAdjustmentType.SCRAP:
			case StockAdjustmentType.DAMAGE:
				return -Math.abs(stated);
			case StockAdjustmentType.SET:
				return stated - current;
			default:
				return 0;
		}
	}

	/** Resolves the level row of the pair. */
	private async findLevel(manager: any, warehouseId: ID, variantId: ID) {
		return await manager
			.createQueryBuilder(WarehouseProductVariant, 'level')
			.innerJoin('level.warehouseProduct', 'aggregate')
			.where('aggregate.warehouseId = :warehouseId', { warehouseId })
			.andWhere('level.variantId = :variantId', { variantId })
			.getOne();
	}

	/**
	 * Reads the product of a variant, which the ledger row needs for its denormalised reference.
	 *
	 * Read through the level service rather than as raw SQL: the `SELECT … WHERE "id" = $1` this method
	 * used to carry is a PostgreSQL placeholder, and the embedded dialect refused it with `RangeError: Too
	 * many parameter values were provided` the first time a correction had to create a level.
	 */
	private async productOf(manager: any, variantId: ID): Promise<ID | undefined> {
		return this.stockLevelService.productOfVariant(manager, variantId);
	}
}
