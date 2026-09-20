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
import { EventBus, FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { InventoryPermission } from './../inventory.permissions';
import { ChannelWarehouse } from './../channel-warehouse/channel-warehouse.entity';
import { ChannelWarehouseService } from './../channel-warehouse/channel-warehouse.service';

/**
 * **The gate is the catalogue's.** `FeatureFlagGuard` is appended to the guard chain this resolver
 * already carried, and the code it reads is `FEATURE_GRAPHQL` — the commerce catalogue's entry for "the
 * GraphQL endpoint and its resolvers, under the same guards and permissions as REST". The code is
 * imported rather than restated because the value has to agree with the catalogue's `code` and nothing
 * checks one string against another: a literal that drifted names a code no catalogue row carries, which
 * the guard resolves as disabled, so every field here would answer `Cannot query field <name>` for every
 * caller with nothing red anywhere. One statement on the class puts every field behind it, and a tenant
 * that switched the capability off is answered the refusal a disabled capability's routes answer with a
 * 404.
 */
@Resolver('ChannelWarehouse')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
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
