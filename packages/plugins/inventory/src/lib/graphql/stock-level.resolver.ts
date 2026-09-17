/**
 * GraphQL resolver of the WarehouseProductVariant resource.
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
import { WarehouseProductVariant } from '@gauzy/core';
import { StockLevelService } from './../stock-level/stock-level.service';
import { InventoryLevelChangedEvent } from './../events';

@Resolver('InventoryLevel')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
export class StockLevelResolver {
	constructor(
		private readonly service: StockLevelService,
		private readonly eventBus: EventBus
	) {}

	/** The levels of a location or of a variant, with their derived availability. */
	@Query('inventoryLevels')
	@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
	async inventoryLevels(@Args('warehouseId') warehouseId: string, @Args('variantId') variantId: string): Promise<any> {
		return await this.service.findLevels({ warehouseId, variantId });
	}

	/** One level row with its derived availability. */
	@Query('inventoryLevel')
	@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
	async inventoryLevel(@Args('warehouseId') warehouseId: string, @Args('variantId') variantId: string): Promise<any> {
		return await this.service.findLevel(warehouseId, variantId);
	}

	/** Availability of a variant at a location: on hand minus reserved minus the unsellable buffer. */
	@Query('availableQuantity')
	@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
	async availableQuantity(@Args('warehouseId') warehouseId: string, @Args('variantId') variantId: string): Promise<any> {
		return await this.service.availableQuantity(warehouseId, variantId);
	}

	/**
	 * Emitted whenever a level row changes.
	 *
	 * Declared so a client subscribes instead of polling. The stream is the platform’s event bus, so a
	 * subscriber sees exactly the events the domain already publishes for its outbox.
	 */
	@Subscription('inventoryLevelChanged')
	inventoryLevelChanged(@Args('warehouseId') warehouseId: string, @Args('variantId') variantId: string): any {
		return this.eventBus.ofType(InventoryLevelChangedEvent).pipe(map((event) => event.level));
	}
}
