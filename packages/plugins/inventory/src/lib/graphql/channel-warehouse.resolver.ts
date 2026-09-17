/**
 * GraphQL resolver of the ChannelWarehouse resource.
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
import { ChannelWarehouse } from './../channel-warehouse/channel-warehouse.entity';
import { ChannelWarehouseService } from './../channel-warehouse/channel-warehouse.service';

@Resolver('ChannelWarehouse')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
export class ChannelWarehouseResolver {
	constructor(
		private readonly service: ChannelWarehouseService
	) {}

	/** Which locations a sales context may draw on. */
	@Query('channelWarehouses')
	@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
	async channelWarehouses(@Args('channelId') channelId: string, @Args('warehouseId') warehouseId: string): Promise<any> {
		return await this.service.findAssignments({ where: { channelId, warehouseId } });
	}

	/** Enables a location for a context. */
	@Mutation('assignChannelWarehouse')
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	async assignChannelWarehouse(@Args('input') input: any): Promise<any> {
		return await this.service.assign(input);
	}

	/** Disables a location for a context. */
	@Mutation('unassignChannelWarehouse')
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	async unassignChannelWarehouse(@Args('channelId') channelId: string, @Args('warehouseId') warehouseId: string): Promise<any> {
		return await this.service.unassign(channelId, warehouseId).then(() => true);
	}
}
