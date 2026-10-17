import { Injectable } from '@nestjs/common';
import { FindManyOptions } from 'typeorm';
import { ID, IPagination } from '@gauzy/contracts';
import { RequestContext, TenantAwareCrudService } from '@gauzy/core';
import { StockMovement } from './stock-movement.entity';
import { TypeOrmStockMovementRepository } from './repository/type-orm-stock-movement.repository';
import { MikroOrmStockMovementRepository } from './repository/mikro-orm-stock-movement.repository';
import { InventoryErrorCode, inventoryError } from './../inventory.errors';

/**
 * Reads the ledger.
 *
 * The class extends the platform’s tenant-aware CRUD service so that reads inherit the tenant and
 * organization scoping every other resource has, and then closes every mutating entry point the base
 * class offers. That is stronger than simply not extending it: the append-only rule is enforced by an
 * explicit refusal rather than by the absence of a method, so a caller that reaches for `update`
 * gets a stated reason instead of a silent no-op, and a test can assert it.
 */
@Injectable()
export class StockMovementService extends TenantAwareCrudService<StockMovement> {
	constructor(
		readonly typeOrmStockMovementRepository: TypeOrmStockMovementRepository,
		readonly mikroOrmStockMovementRepository: MikroOrmStockMovementRepository
	) {
		super(typeOrmStockMovementRepository, mikroOrmStockMovementRepository);
	}

	/**
	 * The ledger is written by `StockLevelService.applyMovement` and by nothing else.
	 *
	 * A movement carries the resulting quantity of the level row it changed, so it can only be
	 * produced by the transaction that wrote that row. Accepting one from a caller would let the
	 * ledger and the level disagree.
	 */
	public async append(): Promise<never> {
		throw inventoryError(
			InventoryErrorCode.MOVEMENT_NOT_APPENDABLE,
			'A movement is written by the stock level engine inside the transaction that updated the level row. Use POST /stock-levels/adjust, a transfer transition or a count close instead.'
		);
	}

	/** A movement is never updated; a correction is a new reversing movement. */
	public async update(): Promise<never> {
		throw inventoryError(
			InventoryErrorCode.MOVEMENT_NOT_APPENDABLE,
			'The stock ledger is append-only: a movement is never updated. Record a reversing movement instead.'
		);
	}

	/** A movement is never deleted. */
	public async delete(): Promise<never> {
		throw inventoryError(
			InventoryErrorCode.MOVEMENT_NOT_APPENDABLE,
			'The stock ledger is append-only: a movement is never deleted. Record a reversing movement instead.'
		);
	}

	/** A movement is never soft-deleted either, so a report cannot lose history. */
	public async softDelete(): Promise<never> {
		throw inventoryError(
			InventoryErrorCode.MOVEMENT_NOT_APPENDABLE,
			'The stock ledger is append-only: a movement is never soft-deleted. Record a reversing movement instead.'
		);
	}

	/** A movement is never removed. */
	public async softRemove(): Promise<never> {
		throw inventoryError(
			InventoryErrorCode.MOVEMENT_NOT_APPENDABLE,
			'The stock ledger is append-only: a movement is never removed. Record a reversing movement instead.'
		);
	}

	/**
	 * Lists the ledger of one level, newest first.
	 *
	 * @param filter the level the caller is reading and how much of it.
	 */
	public async findLedger(filter: {
		variantId: ID;
		warehouseId: ID;
		from?: Date;
		to?: Date;
		take?: number;
	}): Promise<IPagination<StockMovement>> {
		const options: FindManyOptions<StockMovement> = {
			where: {
				variantId: filter.variantId,
				warehouseId: filter.warehouseId
			} as any,
			order: { occurredAt: 'DESC' } as any,
			take: filter.take ?? 100
		};
		return await this.paginate(options);
	}

	/**
	 * Sums the ledger of one level.
	 *
	 * This is the reconciliation primitive of the domain: the sum over a level’s movements is the
	 * level’s on-hand quantity, and any difference is a defect the nightly job reports.
	 */
	public async sumForLevel(variantId: ID, warehouseId: ID): Promise<number> {
		const tenantId = RequestContext.currentTenantId();
		const raw = await this.typeOrmStockMovementRepository
			.createQueryBuilder('movement')
			.select('COALESCE(SUM(movement.quantity), 0)', 'total')
			.where('movement.variantId = :variantId', { variantId })
			.andWhere('movement.warehouseId = :warehouseId', { warehouseId })
			.andWhere('movement.tenantId = :tenantId', { tenantId })
			.getRawOne();
		return Number(raw?.total ?? 0);
	}
}
