/**
 * GraphQL resolver of the StockMovement resource.
 *
 * It delegates to the same service the REST controller uses, so both protocols answer from one
 * implementation and a permission declared here is the permission the REST route carries. The
 * resolver is schema-first, matching the platform’s existing resolvers: the schema literal declares
 * the types and this class binds them to the service.
 */
import { Args, Query, Resolver } from '@nestjs/graphql';
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
import { StockMovement } from './../stock-movement/stock-movement.entity';
import { StockMovementService } from './../stock-movement/stock-movement.service';

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
@Resolver('StockMovement')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
export class StockMovementResolver {
	constructor(
		private readonly service: StockMovementService
	) {}

	/**
	 * The ledger of one level, newest first, as a page a cursor can walk.
	 *
	 * **The window is read in the store, not sliced here.** `findLedger` is a wrapper over `paginate`,
	 * and `paginate` reads a stated `skip` as a page *number* — it multiplies it by `take` before the
	 * query runs — so a row offset handed to it would answer a different page than the cursor named,
	 * which is a walk that repeats rows and skips others with nothing red anywhere. The service's own
	 * row-offset read is `findAll`, which is what a connection's window states, so the page and its
	 * count come from one query and `totalCount` is the size of the filtered ledger rather than of the
	 * page.
	 *
	 * The order travels with the window for the same reason: "newest first" is what the pages are a
	 * walk of, and a limit read without it answers whichever rows the store happens to return.
	 */
	@Query('stockMovements')
	@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
	async stockMovements(
		@Args('warehouseId') warehouseId: string,
		@Args('variantId') variantId: string,
		@Args('page', { type: () => Object, nullable: true }) page?: IConnectionPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	): Promise<GraphqlConnection<StockMovement>> {
		const { skip, take } = resolveConnectionWindow(page);
		const listing = (await this.service.findAll({
			where: { warehouseId, variantId },
			// Closed by the row's identity: movements posted in one instant — a transfer's two legs, a count's
			// corrections — are otherwise a tie the store may arrange differently on the next page.
			order: { occurredAt: 'DESC', id: 'DESC' },
			skip,
			take,
			...(withDeleted ? { withDeleted: true } : {})
		})) as IPagination<StockMovement>;

		return connectionFromOffsetPage(listing, skip);
	}

	/**
	 * Reads one ledger row by id.
	 *
	 * The route it mirrors is `GET /stock-movements/:id`, declared by this resource's controller and
	 * calling the same `findOneByIdString(id)` below. The permission is the one that route runs under:
	 * the handler states none of its own, so `PermissionGuard` resolves the controller's class-level
	 * `STOCK_VIEW`, stated here rather than inherited so both surfaces read the same requirement. The
	 * listing above is the ledger of a level; this is the one entry a caller holding its identifier
	 * asks about, which the REST caller beside it can already do.
	 *
	 * The answer is nullable because a miss is the row's absence rather than a refusal, which is how
	 * the sibling node queries of this package answer one.
	 *
	 * @param id The movement to read.
	 * @returns The movement, or null when no such row is visible to the caller.
	 */
	@Query('stockMovement')
	@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
	@Versioned({ write: false })
	async stockMovement(@Args('id') id: string): Promise<any> {
		return await this.service.findOneByIdString(id);
	}
}
