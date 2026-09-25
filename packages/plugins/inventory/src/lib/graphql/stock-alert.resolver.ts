/**
 * GraphQL resolver of the StockAlert resource.
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
	Idempotent,
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
import { StockAlert } from './../stock-alert/stock-alert.entity';
import { StockAlertService } from './../stock-alert/stock-alert.service';

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
@Resolver('StockAlert')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
export class StockAlertResolver {
	constructor(
		private readonly service: StockAlertService
	) {}

	/**
	 * Alert rules, as a page a cursor can walk.
	 *
	 * **The window is read in the store, not sliced here.** `findAlerts` is a wrapper over `paginate`, and
	 * `paginate` reads a stated `skip` as a page *number* — it multiplies it by `take` before the query
	 * runs — so a row offset handed to it would answer a different page than the cursor named: a walk
	 * that repeats rules and skips others, with nothing red anywhere. The service's own row-offset read
	 * is `findAll`, which is what a connection's window states, so the page and its `totalCount` come
	 * from one query and the count is the size of the filtered set rather than of the page.
	 */
	@Query('stockAlerts')
	@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
	async stockAlerts(
		@Args('variantId') variantId: string,
		@Args('isActive') isActive: boolean,
		@Args('page', { type: () => Object, nullable: true }) page?: IConnectionPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	): Promise<GraphqlConnection<StockAlert>> {
		const { skip, take } = resolveConnectionWindow(page);
		const listing = (await this.service.findAll({
			where: { variantId, isActive },
			// In the order the rows were written, closed by the row's identity: the page is cut with
			// LIMIT/OFFSET and its cursors are offsets, so an order with ties lets the store arrange them
			// differently on the next page.
			order: { createdAt: 'ASC', id: 'ASC' },
			skip,
			take,
			...(withDeleted ? { withDeleted: true } : {})
		})) as IPagination<StockAlert>;

		return connectionFromOffsetPage(listing, skip);
	}

	/**
	 * Reads one alert rule by id.
	 *
	 * The route it mirrors is `GET /stock-alerts/:id`, declared by this resource's controller and
	 * calling the same `findOneByIdString(id)` below. The permission is the one that route runs under:
	 * the handler states none of its own, so `PermissionGuard` resolves the controller's class-level
	 * `STOCK_VIEW`, stated here rather than inherited so both surfaces read the same requirement.
	 *
	 * The answer is nullable because a miss is the rule's absence rather than a refusal, which is how
	 * the sibling node queries of this package answer one.
	 *
	 * @param id The alert rule to read.
	 * @returns The rule, or null when no such row is visible to the caller.
	 */
	@Query('stockAlert')
	@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
	@Versioned({ write: false })
	async stockAlert(@Args('id') id: string): Promise<any> {
		return await this.service.findOneByIdString(id);
	}

	/**
	 * Creates a rule.
	 *
	 * The key is the input member the REST route's header mirrors: a rule a client retried after losing
	 * the response is replayed rather than created a second time under a new threshold.
	 */
	@Mutation('createStockAlert')
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	@Idempotent({ scope: 'stock.alert.create', required: false, resourceType: 'stock-alert' })
	async createStockAlert(@Args('input') input: any): Promise<any> {
		return await this.service.createAlert(input);
	}

	/** Updates a rule. */
	@Mutation('updateStockAlert')
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	async updateStockAlert(@Args('id') id: string, @Args('input') input: any): Promise<any> {
		return await this.service.update(id, input);
	}

	/** Deletes a rule. */
	@Mutation('deleteStockAlert')
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	async deleteStockAlert(@Args('id') id: string): Promise<any> {
		return await this.service.delete(id).then(() => true);
	}
}
