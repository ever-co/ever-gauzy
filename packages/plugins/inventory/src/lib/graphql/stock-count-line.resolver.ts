/**
 * GraphQL resolver of the StockCountLine resource.
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
	connectionFromOffsetPage,
	resolveConnectionWindow
} from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { InventoryPermission } from './../inventory.permissions';
import { StockCountLine } from './../stock-count-line/stock-count-line.entity';
import { StockCountLineService } from './../stock-count-line/stock-count-line.service';

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
@Resolver('StockCountLine')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
export class StockCountLineResolver {
	constructor(
		private readonly service: StockCountLineService
	) {}

	/**
	 * The lines of a count session, as a page a cursor can walk.
	 *
	 * **The window is read in the store, not sliced here.** `findLines` is a wrapper over `paginate`, and
	 * `paginate` reads a stated `skip` as a page *number* — it multiplies it by `take` before the query
	 * runs — so a row offset handed to it would answer a different page than the cursor named: a walk
	 * that repeats lines and skips others, with nothing red anywhere. The service's own row-offset read
	 * is `findAll`, which is what a connection's window states, so the page and its `totalCount` come
	 * from one query and the count is the size of the filtered set rather than of the page.
	 */
	@Query('stockCountLines')
	@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
	async stockCountLines(
		@Args('stockCountId') stockCountId: string,
		@Args('page', { type: () => Object, nullable: true }) page?: IConnectionPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	): Promise<GraphqlConnection<StockCountLine>> {
		const { skip, take } = resolveConnectionWindow(page);
		const listing = (await this.service.findAll({
			where: { stockCountId },
			// In the order the rows were written, closed by the row's identity: the page is cut with
			// LIMIT/OFFSET and its cursors are offsets, so an order with ties lets the store arrange them
			// differently on the next page.
			order: { createdAt: 'ASC', id: 'ASC' },
			skip,
			take,
			...(withDeleted ? { withDeleted: true } : {})
		})) as IPagination<StockCountLine>;

		return connectionFromOffsetPage(listing, skip);
	}

	/** One count line. */
	@Query('stockCountLine')
	@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
	async stockCountLine(@Args('id') id: string): Promise<any> {
		return await this.service.findOneByIdString(id);
	}

	/** The variance of a session, in units and valued at the recorded unit cost. */
	@Query('stockCountVariance')
	@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
	async stockCountVariance(@Args('stockCountId') stockCountId: string): Promise<any> {
		return await this.service.varianceOf(stockCountId);
	}
}
