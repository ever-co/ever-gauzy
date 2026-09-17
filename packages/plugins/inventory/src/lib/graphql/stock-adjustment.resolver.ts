/**
 * GraphQL resolver of the StockAdjustment resource.
 *
 * It delegates to the same service the REST controller uses, so both protocols answer from one
 * implementation and a permission declared here is the permission the REST route carries. The
 * resolver is schema-first, matching the platform’s existing resolvers: the schema literal declares
 * the types and this class binds them to the service.
 */
import { Args, ID, Int, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { map } from 'rxjs/operators';
import { PermissionsEnum } from '@gauzy/contracts';
import { EventBus, Permissions, PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { InventoryPermission } from './../inventory.permissions';
import { StockAdjustmentStatus } from './../inventory.enums';
import { StockAdjustment } from './../stock-adjustment/stock-adjustment.entity';
import { StockAdjustmentService } from './../stock-adjustment/stock-adjustment.service';

@Resolver('StockAdjustment')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
export class StockAdjustmentResolver {
	constructor(
		private readonly service: StockAdjustmentService
	) {}

	/** Manual correction instructions. */
	@Query('stockAdjustments')
	@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
	async stockAdjustments(@Args('warehouseId') warehouseId: string, @Args('variantId') variantId: string, @Args('status') status: StockAdjustmentStatus): Promise<any> {
		return await this.service.findAdjustments({ where: { warehouseId, variantId, status } });
	}

	/** Drafts a manual correction. */
	@Mutation('adjustStock')
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	async adjustStock(@Args('input') input: any): Promise<any> {
		return await this.service.createAdjustment(input);
	}

	/** Applies a drafted correction and writes its ledger row. */
	@Mutation('applyStockAdjustment')
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	async applyStockAdjustment(@Args('id') id: string): Promise<any> {
		return await this.service.apply(id).then((result) => result.adjustment);
	}
}
