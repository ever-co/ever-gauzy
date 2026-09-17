import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import {
	Permissions,
	PermissionGuard,
	TenantPermissionGuard,
	UUIDValidationPipe,
	UseValidationPipe
} from '@gauzy/core';
import { InventoryPermission } from './../inventory.permissions';
import { InventoryErrorCode, inventoryError } from './../inventory.errors';
import { StockLevelService } from './stock-level.service';
import { IStockAvailability, IStockReconciliation } from './stock-level.types';
import { ReconcileStockLevelsDTO } from './dto';

/**
 * The stock level resource: what one variant holds at one location, and how that compares to the
 * movement ledger.
 *
 * There is deliberately no route that writes a quantity. A level is the cached sum of its movements,
 * so it is changed by the document that moved the stock — a receipt, a transfer, a hold, a manual
 * correction, a count — and never by a caller editing the number. The one write this resource serves
 * is the reconciliation, which corrects a level from its own ledger and records the correction as a
 * movement like every other change.
 *
 * The availability a level reports is derived on read rather than stored, so nothing here has to keep
 * a third number in step with the two it is computed from.
 */
@ApiTags('StockLevel')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
@Controller('/stock-levels')
export class StockLevelController {
	constructor(private readonly stockLevelService: StockLevelService) {}

	/**
	 * Lists the levels of a location, of a variant, or of the caller's tenant.
	 */
	@ApiOperation({ summary: 'List stock levels' })
	@ApiResponse({ status: 200, description: 'Levels found.' })
	@Get()
	async findAll(
		@Query('warehouseId', UUIDValidationPipe) warehouseId?: ID,
		@Query('variantId', UUIDValidationPipe) variantId?: ID,
		@Query('take') take?: number
	): Promise<IStockAvailability[]> {
		return await this.stockLevelService.findLevels({
			warehouseId,
			variantId,
			take: take ? Number(take) : undefined
		});
	}

	/**
	 * Reads one level, with the availability it derives.
	 *
	 * A level of another tenant is not a level this caller may read, so it is answered exactly as a
	 * level that does not exist: the id is not a capability, and the two answers are the same one.
	 */
	@ApiOperation({ summary: 'Find one stock level by id' })
	@ApiResponse({ status: 200, description: 'Level found.' })
	@ApiResponse({ status: 404, description: 'Level not found.' })
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<IStockAvailability> {
		const level = await this.stockLevelService.findLevelById(id);
		if (!level) {
			throw inventoryError(InventoryErrorCode.LEVEL_NOT_FOUND, 'The stock level does not exist.', {
				notFound: true,
				details: { levelId: id }
			});
		}
		return level;
	}

	/**
	 * Recomputes the levels from the movement ledger and records every correction it made.
	 *
	 * The ledger is the truth and a level is its cache, so this is the route an operator runs when the
	 * two are suspected of disagreeing. It is a write, which is why it carries the reconciliation
	 * permission rather than the read one: a correction appends a movement to the ledger, and the
	 * ledger is the record the business is audited against.
	 */
	@ApiOperation({ summary: 'Reconcile stock levels against the movement ledger' })
	@ApiResponse({ status: 202, description: 'Levels reconciled.' })
	@Permissions(InventoryPermission.STOCK_RECONCILE as PermissionsEnum)
	@Post('reconcile')
	@UseValidationPipe({ transform: true, whitelist: true })
	async reconcile(@Body() entity: ReconcileStockLevelsDTO): Promise<IStockReconciliation> {
		return await this.stockLevelService.reconcile({
			warehouseId: entity?.warehouseId as ID,
			variantId: entity?.variantId as ID,
			take: entity?.take
		});
	}
}
