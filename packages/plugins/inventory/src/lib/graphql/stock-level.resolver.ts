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
import { map } from 'rxjs/operators';
import { PermissionsEnum } from '@gauzy/contracts';
import {
	EventBus,
	FeatureFlagGuard,
	Idempotent,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	Versioned
} from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { InventoryPermission } from './../inventory.permissions';
import { StockLevelService } from './../stock-level/stock-level.service';
import { InventoryLevelChangedEvent } from './../events';

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
	 */
	@Query('stockLevels')
	@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
	@Versioned({ write: false })
	async stockLevels(
		@Args('warehouseId') warehouseId: string,
		@Args('variantId') variantId: string,
		@Args('take', { type: () => Int, nullable: true }) take: number
	): Promise<any> {
		return await this.service.findLevels({ warehouseId, variantId, take });
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
	 */
	@Subscription('stockLevelChanged')
	stockLevelChanged(@Args('warehouseId') warehouseId: string, @Args('variantId') variantId: string): any {
		return this.eventBus.ofType(InventoryLevelChangedEvent).pipe(map((event) => event.level));
	}
}
