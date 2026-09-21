/**
 * GraphQL resolver of the StockTransferLine resource.
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
	connectionFromOffsetPage,
	resolveConnectionWindow
} from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { InventoryPermission } from './../inventory.permissions';
import { StockTransferLine } from './../stock-transfer-line/stock-transfer-line.entity';
import { StockTransferLineService } from './../stock-transfer-line/stock-transfer-line.service';

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
@Resolver('StockTransferLine')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
export class StockTransferLineResolver {
	constructor(
		private readonly service: StockTransferLineService
	) {}

	/**
	 * The lines of a transfer, as a page a cursor can walk.
	 *
	 * **The window is read in the store, not sliced here.** `findLines` is a wrapper over `paginate`, and
	 * `paginate` reads a stated `skip` as a page *number* — it multiplies it by `take` before the query
	 * runs — so a row offset handed to it would answer a different page than the cursor named: a walk
	 * that repeats lines and skips others, with nothing red anywhere. The service's own row-offset read
	 * is `findAll`, which is what a connection's window states, so the page and its `totalCount` come
	 * from one query and the count is the size of the filtered set rather than of the page.
	 */
	@Query('stockTransferLines')
	@Permissions(InventoryPermission.STOCK_TRANSFER_VIEW as PermissionsEnum)
	async stockTransferLines(
		@Args('transferId') transferId: string,
		@Args('page', { type: () => Object, nullable: true }) page?: IConnectionPageSelection
	): Promise<GraphqlConnection<StockTransferLine>> {
		const { skip, take } = resolveConnectionWindow(page);
		const listing = (await this.service.findAll({
			where: { transferId },
			skip,
			take
		})) as IPagination<StockTransferLine>;

		return connectionFromOffsetPage(listing, skip);
	}

	/** One transfer line. */
	@Query('stockTransferLine')
	@Permissions(InventoryPermission.STOCK_TRANSFER_VIEW as PermissionsEnum)
	async stockTransferLine(@Args('id') id: string): Promise<any> {
		return await this.service.findOneByIdString(id);
	}

	/** Adds a variant to a draft transfer. */
	@Mutation('addStockTransferLine')
	@Permissions(InventoryPermission.STOCK_TRANSFER_CREATE as PermissionsEnum)
	async addStockTransferLine(@Args('input') input: any): Promise<any> {
		return await this.service.addLine(input);
	}
}
