/**
 * GraphQL resolver of the StockCount resource.
 *
 * It delegates to the same service the REST controller uses, so both protocols answer from one
 * implementation and a permission declared here is the permission the REST route carries. The
 * resolver is schema-first, matching the platform’s existing resolvers: the schema literal declares
 * the types and this class binds them to the service.
 */
import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { DecimalString, IPagination, PermissionsEnum } from '@gauzy/contracts';
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
import { toDecimalWire } from './../inventory.decimal';
import { InventoryPermission } from './../inventory.permissions';
import { StockCountMode, StockCountStatus } from './../inventory.enums';
import { StockCount } from './../stock-count/stock-count.entity';
import { StockCountService } from './../stock-count/stock-count.service';
import { STOCK_LEVEL_VERSION_TARGET } from './../stock-level/stock-level.types';

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
@Resolver('StockCount')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
export class StockCountResolver {
	constructor(
		private readonly service: StockCountService
	) {}

	/**
	 * Count sessions, as a page a cursor can walk.
	 *
	 * **The window is read in the store, not sliced here.** `findCounts` is a wrapper over `paginate`, and
	 * `paginate` reads a stated `skip` as a page *number* — it multiplies it by `take` before the query
	 * runs — so a row offset handed to it would answer a different page than the cursor named: a walk
	 * that repeats sessions and skips others, with nothing red anywhere. The service's own row-offset
	 * read is `findAll`, which is what a connection's window states, so the page and its `totalCount`
	 * come from one query and the count is the size of the filtered set rather than of the page.
	 */
	@Query('stockCounts')
	@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
	async stockCounts(
		@Args('warehouseId') warehouseId: string,
		@Args('status') status: StockCountStatus,
		@Args('mode') mode: StockCountMode,
		@Args('page', { type: () => Object, nullable: true }) page?: IConnectionPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	): Promise<GraphqlConnection<StockCount>> {
		const { skip, take } = resolveConnectionWindow(page);
		const listing = (await this.service.findAll({
			where: { warehouseId, status, mode },
			// Newest first, closed by the row's identity: the page is cut with LIMIT/OFFSET and its cursors are
			// offsets, so an order with ties lets the store arrange them differently on the next page.
			order: { createdAt: 'DESC', id: 'DESC' },
			skip,
			take,
			...(withDeleted ? { withDeleted: true } : {})
		})) as IPagination<StockCount>;

		return connectionFromOffsetPage(listing, skip);
	}

	/** One session with its lines. */
	@Query('stockCount')
	@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
	async stockCount(@Args('id') id: string): Promise<any> {
		return await this.service.findOneByIdString(id, { relations: ["lines"] });
	}

	/** Creates a draft session. */
	@Mutation('createStockCount')
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	async createStockCount(@Args('input') input: any): Promise<any> {
		return await this.service.createCount(input);
	}

	/** Generates the lines and snapshots the expectation. */
	@Mutation('openStockCount')
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	async openStockCount(@Args('id') id: string): Promise<any> {
		return await this.service.open(id);
	}

	/**
	 * Records a batch of readings.
	 *
	 * The readings are a write on the session and not on the levels — nothing moves until the session
	 * closes — so this mutation carries the key and not the version, with the same scope the REST route
	 * declares. A retry that recorded the same readings twice would double-count a batch of the
	 * variance.
	 */
	@Mutation('recordStockCountLine')
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	@Idempotent({ scope: 'stock.count', required: false, resourceType: 'stock-count' })
	async recordStockCountLine(
		@Args('id') id: string,
		@Args('lines') lines: any[],
		@Args('idempotencyKey', { type: () => String, nullable: true }) idempotencyKey: string
	): Promise<any> {
		void idempotencyKey;

		return await this.service.recordLines(id, lines);
	}

	/**
	 * Closes the session and writes its corrections.
	 *
	 * The corrections land on the levels of the lines the session covers, so the version is optional
	 * for the reason the REST route states it optionally — a stated version is honoured for the level
	 * it names and the compare-and-set covers the rest — and the key makes a retry of the close replay
	 * rather than write a second set of corrections.
	 */
	@Mutation('closeStockCount')
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	@Versioned({ required: false, target: STOCK_LEVEL_VERSION_TARGET })
	@Idempotent({ scope: 'stock.count', required: false, resourceType: 'stock-count' })
	async closeStockCount(
		@Args('id') id: string,
		@Args('idempotencyKey', { type: () => String, nullable: true }) idempotencyKey: string
	): Promise<any> {
		void idempotencyKey;

		return await this.service.close(id).then((result) => result.count);
	}

	/**
	 * Cancels a session without writing its corrections.
	 *
	 * The route it mirrors is `POST /stock-counts/:id/cancel`, which the domain's own surface table states
	 * in the same row as the open, the count and the close — so the capability is one the specification
	 * names rather than one this wave inferred from a handler. Nothing is moved by a cancel: the session
	 * ends and every level stays where it was, which is why the session's status is the whole answer.
	 *
	 * The permission is the route's own — `STOCK_EDIT` — and not the class-level `STOCK_VIEW`: closing a
	 * sheet is an inventory write whichever end of it a caller takes, and the route demands the edit grant
	 * for the cancel exactly as it does for the close. The route declares no retry scope and no version
	 * expectation, and the domain's own list of the actions that honour an `Idempotency-Key` omits the
	 * cancel — so the field declares neither, and a second cancel is answered by the row's own status.
	 *
	 * @param id The session to cancel.
	 * @returns The session, ended.
	 */
	@Mutation('cancelStockCount')
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	async cancelStockCount(@Args('id') id: string): Promise<any> {
		return await this.service.cancel(id);
	}

	/**
	 * The session's valuation, as the exact decimal the schema declares.
	 *
	 * `varianceValue` is a `numeric(20,6)` column typed `Decimal`, and the platform's `Decimal` scalar has
	 * no serializer: the column went out as the driver hydrated it — the text `'7.500000'` on Postgres and
	 * MySQL, the float `7.5` on SQLite — so one field had two wire types, and the float form rounds a figure
	 * past sixteen significant digits on the server. Every session this type answers passes through here,
	 * whichever field or mutation produced it.
	 *
	 * @param count The session being answered.
	 * @returns Its valuation as exact decimal text at six decimals.
	 */
	@ResolveField('varianceValue')
	varianceValue(@Parent() count: StockCount): DecimalString | null {
		return toDecimalWire(count.varianceValue);
	}
}
