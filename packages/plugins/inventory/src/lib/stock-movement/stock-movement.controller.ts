import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
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
	 *
	 * Both filters are required — the ledger has no tenant-wide read, and the GraphQL field of the same
	 * concept declares both as non-null, so the two protocols have the same scope. What the refusal says
	 * matters: a request that states no filter is a request the caller got wrong, and it is answered as
	 * one. The platform's parameter pipe reports an absent identifier as "not found", which on a list
	 * route is the status that means the route is not mounted at all, and a caller cannot tell a
	 * required filter from a missing endpoint.
	 */
	@ApiOperation({ summary: 'List stock movements' })
	@ApiResponse({ status: 200, description: 'Movements found.' })
	@ApiResponse({ status: 400, description: 'A required filter is absent or is not an identifier.' })
	@Get()
	async findAll(
		@Query('variantId', ParseUUIDPipe) variantId: ID,
		@Query('warehouseId', ParseUUIDPipe) warehouseId: ID,
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
