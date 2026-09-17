import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ID, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { Permissions, PermissionGuard, TenantPermissionGuard, UUIDValidationPipe } from '@gauzy/core';
import { InventoryPermission } from './../inventory.permissions';
import { StockMovement } from './stock-movement.entity';
import { StockMovementService } from './stock-movement.service';

/**
 * Exposes the stock ledger for reading only.
 *
 * There is deliberately no create, update or delete route: a movement is produced by the transaction
 * that changes the level row, and the ledger is the platform’s record of what actually happened.
 */
@ApiTags('StockMovement')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
@Controller('/stock-movements')
export class StockMovementController {
	constructor(private readonly stockMovementService: StockMovementService) {}

	/**
	 * Lists ledger rows for a level, filtered by variant and location.
	 */
	@ApiOperation({ summary: 'List stock movements' })
	@ApiResponse({ status: 200, description: 'Movements found.' })
	@Get()
	async findAll(
		@Query('variantId', UUIDValidationPipe) variantId: ID,
		@Query('warehouseId', UUIDValidationPipe) warehouseId: ID,
		@Query('take') take?: number
	): Promise<IPagination<StockMovement>> {
		return await this.stockMovementService.findLedger({ variantId, warehouseId, take: take ? Number(take) : undefined });
	}

	/**
	 * Reads one movement, with the quantity it produced.
	 */
	@ApiOperation({ summary: 'Find one stock movement by id' })
	@ApiResponse({ status: 200, description: 'Movement found.' })
	@ApiResponse({ status: 404, description: 'Movement not found.' })
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<StockMovement> {
		return await this.stockMovementService.findOneByIdString(id);
	}
}
