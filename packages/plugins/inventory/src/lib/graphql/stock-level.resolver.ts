/**
 * GraphQL resolver of the stock level resource.
 *
 * It delegates to the same service the REST controller uses, so both protocols answer from one
 * implementation and a permission declared here is the permission the REST route carries. The
 * resolver is schema-first, matching the platform’s existing resolvers: the schema literal declares
 * the types and this class binds them to the service.
 */
import { Args, Int, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { PermissionsEnum } from '@gauzy/contracts';
import {
	EventBus,
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
import { StockLevelService } from './../stock-level/stock-level.service';
import { InventoryLevelChangedEvent, InventoryLevelLowEvent, InventoryLevelOutOfStockEvent } from './../events';
import { IStockAvailability } from './../stock-level/stock-level.types';

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
@Resolver('StockLevel')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
export class StockLevelResolver {
	constructor(
		private readonly service: StockLevelService,
		private readonly eventBus: EventBus
	) {}

	/**
	 * The levels of a location or of a variant, with their derived availability.
	 *
	 * A GraphQL operation is always a `POST`, so the resolver states that this one reads rather than
	 * letting the transport decide: the version travels out with the levels and is never demanded of
	 * the caller.
	 *
	 * The page comes from `listLevels`, which reads the window *and* counts the set the filters select. The
	 * `take` argument this field used to carry is gone with it: `page: { first: n }` is the page size now, and
	 * a field with two ways to state one thing is a field whose two ways drift.
	 */
	@Query('stockLevels')
	@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
	@Versioned({ write: false })
	async stockLevels(
		@Args('warehouseId') warehouseId: string,
		@Args('variantId') variantId: string,
		@Args('page', { type: () => Object, nullable: true }) page?: IConnectionPageSelection
	): Promise<GraphqlConnection<IStockAvailability>> {
		const { skip, take } = resolveConnectionWindow(page);
		const listing = await this.service.listLevels({ warehouseId, variantId, skip, take });

		return connectionFromOffsetPage(listing, skip);
	}

	/** One level row with its derived availability, and the counter a write is conditioned on. */
	@Query('stockLevel')
	@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
	@Versioned({ write: false })
	async stockLevel(@Args('warehouseId') warehouseId: string, @Args('variantId') variantId: string): Promise<any> {
		return await this.service.findLevel(warehouseId, variantId);
	}

	/** Availability of a variant at a location: on hand minus reserved minus the unsellable buffer. */
	@Query('availableQuantity')
	@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
	@Versioned({ write: false })
	async availableQuantity(@Args('warehouseId') warehouseId: string, @Args('variantId') variantId: string): Promise<any> {
		return await this.service.availableQuantity(warehouseId, variantId);
	}

	/**
	 * Recomputes the levels from the movement ledger and reports what it corrected.
	 *
	 * The same operation the REST resource serves at its reconciliation route, declared here with the
	 * same scope: a client that reaches this endpoint over GraphQL is not given a narrower or a wider
	 * one than the client that reaches it over REST. It carries the reconciliation permission rather
	 * than the read permission the queries carry, so a role that may look at levels cannot correct them
	 * by choosing the other protocol.
	 *
	 * The version is optional for the reason the REST route states: a run walks a batch of levels and a
	 * caller cannot name one version for all of them, while a stated version is honoured for the level
	 * it names. The key mirrors the REST scope, so a retry over either protocol replays rather than
	 * running the run again.
	 */
	@Mutation('reconcileStockLevels')
	@Permissions(InventoryPermission.STOCK_RECONCILE as PermissionsEnum)
	@Versioned({ required: false })
	@Idempotent({ scope: 'stock.reconcile', required: false, resourceType: 'stock-level' })
	async reconcileStockLevels(@Args('input') input: any): Promise<any> {
		return await this.service.reconcile({
			warehouseId: input?.warehouseId,
			variantId: input?.variantId,
			take: input?.take
		});
	}

	/**
	 * Emitted whenever a level row changes.
	 *
	 * Declared so a client subscribes instead of polling. The stream is the platform’s event bus, so a
	 * subscriber sees exactly the events the domain already publishes for its outbox.
	 *
	 * **The arguments narrow the stream.** They are declared in the schema and were read by nothing, so
	 * a client that subscribed to one location's levels was handed every level of the tenant and had to
	 * filter them itself — which is the opposite of what a subscription argument is for, and is
	 * expensive on the one transport where the server pays for every frame it sends.
	 *
	 * @param warehouseId The location the subscriber asked about, when it asked about one.
	 * @param variantId The variant the subscriber asked about, when it asked about one.
	 * @returns The availabilities, as the domain publishes them.
	 */
	@Subscription('stockLevelChanged')
	stockLevelChanged(@Args('warehouseId') warehouseId: string, @Args('variantId') variantId: string): any {
		return this.stream(InventoryLevelChangedEvent, warehouseId, variantId);
	}

	/**
	 * Emitted when a level row crosses into a low state.
	 *
	 * **The field was declared in the composed schema with nothing bound to it.** A client that
	 * subscribed to it was accepted and then never heard anything — which is the one failure a
	 * subscription cannot be told apart from a quiet warehouse, so nobody would have reported it. The
	 * domain already publishes `InventoryLevelLowEvent`; this binds the stream to it.
	 *
	 * @param warehouseId The location the subscriber asked about, when it asked about one.
	 * @returns The availabilities that crossed the threshold.
	 */
	@Subscription('stockLevelLow')
	@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
	stockLevelLow(@Args('warehouseId') warehouseId: string): any {
		return this.stream(InventoryLevelLowEvent, warehouseId);
	}

	/**
	 * Emitted when a level row reaches zero availability.
	 *
	 * Declared and unbound for the same reason the low-stock stream was, and bound here to the event
	 * the domain already publishes for it.
	 *
	 * @param warehouseId The location the subscriber asked about, when it asked about one.
	 * @returns The availabilities that reached zero.
	 */
	@Subscription('stockLevelOutOfStock')
	@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
	stockLevelOutOfStock(@Args('warehouseId') warehouseId: string): any {
		return this.stream(InventoryLevelOutOfStockEvent, warehouseId);
	}

	/**
	 * One event stream, narrowed to what the subscriber asked for.
	 *
	 * The three level events are separate classes so a subscriber declares which one it cares about
	 * instead of filtering on a field, and the location and variant arguments are applied here so all
	 * three streams narrow the same way rather than each inventing its own reading of them. An argument
	 * the caller left out narrows nothing, which is what a nullable argument means.
	 *
	 * @param event The event class the stream carries.
	 * @param warehouseId The location the subscriber asked about, when it asked about one.
	 * @param variantId The variant the subscriber asked about, when it asked about one.
	 * @returns The availabilities, in the order the domain published them.
	 */
	private stream(
		event: new (...args: never[]) => InventoryLevelChangedEvent,
		warehouseId?: string,
		variantId?: string
	): Observable<IStockAvailability> {
		return this.eventBus.ofType(event).pipe(
			map((published: InventoryLevelChangedEvent) => published.level),
			filter(
				(level: IStockAvailability) =>
					(!warehouseId || String(level?.warehouseId ?? '') === String(warehouseId)) &&
					(!variantId || String(level?.variantId ?? '') === String(variantId))
			)
		);
	}
}
