/**
 * GraphQL resolver of the ChannelWarehouse resource.
 *
 * It delegates to the same service the REST controller uses, so both protocols answer from one
 * implementation and a permission declared here is the permission the REST route carries. The
 * resolver is schema-first, matching the platform’s existing resolvers: the schema literal declares
 * the types and this class binds them to the service.
 */
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { IPagination, PermissionsEnum } from '@gauzy/contracts';
import {
	FeatureFlagGuard,
	GraphqlConnection,
	IConnectionPageSelection,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	Versioned,
	connectionFromOffsetPage,
	resolveConnectionWindow
} from '@gauzy/core';
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

	/**
	 * Which locations a sales context may draw on, as a page a cursor can walk.
	 *
	 * **The window is read in the store, not sliced here.** `findAssignments` is a wrapper over
	 * `paginate`, and `paginate` reads a stated `skip` as a page *number* — it multiplies it by `take`
	 * before the query runs — so a row offset handed to it would answer a different page than the cursor
	 * named: a walk that repeats assignments and skips others, with nothing red anywhere. The service's
	 * own row-offset read is `findAll`, which is what a connection's window states, so the page and its
	 * `totalCount` come from one query and the count is the size of the filtered set rather than of the
	 * page.
	 */
	@Query('channelWarehouses')
	@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
	async channelWarehouses(
		@Args('channelId') channelId: string,
		@Args('warehouseId') warehouseId: string,
		@Args('page', { type: () => Object, nullable: true }) page?: IConnectionPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	): Promise<GraphqlConnection<ChannelWarehouse>> {
		const { skip, take } = resolveConnectionWindow(page);
		const listing = (await this.service.findAll({
			where: { channelId, warehouseId },
			// The order the service resolves eligible locations in, highest priority first, closed by the row's
			// identity: an offset cursor is a position, and two assignments at one priority are otherwise a tie
			// the store may arrange differently on the next page.
			order: { priority: 'DESC', id: 'ASC' },
			skip,
			take,
			...(withDeleted ? { withDeleted: true } : {})
		})) as IPagination<ChannelWarehouse>;

		return connectionFromOffsetPage(listing, skip);
	}

	/**
	 * Reads one assignment by id.
	 *
	 * The route it mirrors is `GET /channel-warehouses/:id`, declared by this resource's controller
	 * and calling the same `findOneByIdString(id)` below. The permission is the one that route runs
	 * under: the handler states none of its own, so `PermissionGuard` resolves the controller's
	 * class-level `STOCK_VIEW`, stated here rather than inherited so both surfaces read the same
	 * requirement. The listing above answers a channel's or a location's assignments; this answers the
	 * one row a caller holding its identifier asks about.
	 *
	 * The answer is nullable because a miss is the row's absence rather than a refusal, which is how
	 * the sibling node queries of this package answer one.
	 *
	 * @param id The assignment to read.
	 * @returns The assignment, or null when no such row is visible to the caller.
	 */
	@Query('channelWarehouse')
	@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
	@Versioned({ write: false })
	async channelWarehouse(@Args('id') id: string): Promise<any> {
		return await this.service.findOneByIdString(id);
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
