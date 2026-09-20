/**
 * GraphQL resolver of the StockTransfer resource.
 *
 * It delegates to the same service the REST controller uses, so both protocols answer from one
 * implementation and a permission declared here is the permission the REST route carries. The
 * resolver is schema-first, matching the platform’s existing resolvers: the schema literal declares
 * the types and this class binds them to the service.
 */
import { Args, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
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
import { StockTransferStatus } from './../inventory.enums';
import { StockTransfer } from './../stock-transfer/stock-transfer.entity';
import { StockTransferService } from './../stock-transfer/stock-transfer.service';
import { StockTransferChangedEvent } from './../events';

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
@Resolver('StockTransfer')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
export class StockTransferResolver {
	constructor(
		private readonly service: StockTransferService,
		private readonly eventBus: EventBus
	) {}

	/** Transfers, filtered by state. */
	@Query('stockTransfers')
	@Permissions(InventoryPermission.STOCK_TRANSFER_VIEW as PermissionsEnum)
	@Versioned({ write: false })
	async stockTransfers(@Args('status') status: StockTransferStatus): Promise<any> {
		return await this.service.findTransfers({ where: { status } });
	}

	/** One transfer with its lines. */
	@Query('stockTransfer')
	@Permissions(InventoryPermission.STOCK_TRANSFER_VIEW as PermissionsEnum)
	@Versioned({ write: false })
	async stockTransfer(@Args('id') id: string): Promise<any> {
		return await this.service.findOneByIdString(id, { relations: ["lines"] });
	}

	/** Drafts a transfer and numbers it. The key makes a retry of the draft safe. */
	@Mutation('createStockTransfer')
	@Permissions(InventoryPermission.STOCK_TRANSFER_CREATE as PermissionsEnum)
	@Idempotent({ scope: 'transfer.create', required: false, resourceType: 'stock-transfer' })
	async createStockTransfer(@Args('input') input: any): Promise<any> {
		return await this.service.createTransfer(input);
	}

	/**
	 * Dispatches a transfer and writes the outbound movements.
	 *
	 * The movements land on the levels of the source location, one per line, so the level write is
	 * protected by the engine's own compare-and-set: one mutation cannot carry the version of many
	 * records. The key is what makes a retry of the dispatch safe, and it carries the same scope the
	 * REST route declares, so the two protocols answer a retry identically.
	 */
	@Mutation('shipStockTransfer')
	@Permissions(InventoryPermission.STOCK_TRANSFER_SHIP as PermissionsEnum)
	@Idempotent({ scope: 'transfer.ship', required: false, resourceType: 'stock-transfer' })
	async shipStockTransfer(
		@Args('id') id: string,
		@Args('lines') lines: any[],
		@Args('idempotencyKey', { type: () => String, nullable: true }) idempotencyKey: string
	): Promise<any> {
		void idempotencyKey;

		return await this.service.ship(id, lines);
	}

	/**
	 * Receives a transfer and writes the inbound movements.
	 *
	 * The movements land on the levels of the destination location, one per line, for the same reason
	 * the dispatch leaves the level write to the engine's compare-and-set. The key mirrors the REST
	 * scope.
	 */
	@Mutation('receiveStockTransfer')
	@Permissions(InventoryPermission.STOCK_TRANSFER_RECEIVE as PermissionsEnum)
	@Idempotent({ scope: 'transfer.receive', required: false, resourceType: 'stock-transfer' })
	async receiveStockTransfer(
		@Args('id') id: string,
		@Args('lines') lines: any[],
		@Args('idempotencyKey', { type: () => String, nullable: true }) idempotencyKey: string
	): Promise<any> {
		void idempotencyKey;

		return await this.service.receive(id, lines);
	}

	/** Cancels a transfer that has not been fully received. */
	@Mutation('cancelStockTransfer')
	@Permissions(InventoryPermission.STOCK_TRANSFER_CANCEL as PermissionsEnum)
	async cancelStockTransfer(@Args('id') id: string, @Args('reason') reason: string): Promise<any> {
		return await this.service.cancel(id, reason);
	}

	/**
	 * Emitted on every transfer transition.
	 *
	 * Declared so a client subscribes instead of polling. The stream is the platform’s event bus, so a
	 * subscriber sees exactly the events the domain already publishes for its outbox.
	 */
	@Subscription('stockTransferChanged')
	stockTransferChanged(@Args('id') id: string): any {
		return this.eventBus.ofType(StockTransferChangedEvent).pipe(map((event) => event.transfer));
	}
}
