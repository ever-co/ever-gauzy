/**
 * GraphQL resolver of the StockMovement resource.
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
import { StockMovement } from './../stock-movement/stock-movement.entity';
import { StockMovementService } from './../stock-movement/stock-movement.service';

@Resolver('StockMovement')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
export class StockMovementResolver {
	constructor(
		private readonly service: StockMovementService
	) {}

	/** The ledger of one level, newest first. */
	@Query('stockMovements')
	@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
	async stockMovements(@Args('warehouseId') warehouseId: string, @Args('variantId') variantId: string, @Args('take') take: number): Promise<any> {
		return await this.service.findLedger({ warehouseId, variantId, take });
	}
}
