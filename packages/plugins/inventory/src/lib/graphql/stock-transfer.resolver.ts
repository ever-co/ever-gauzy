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
import { IPagination, PermissionsEnum } from '@gauzy/contracts';
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

	/**
	 * Transfers, filtered by state, as a page a cursor can walk.
	 *
	 * **The window is read in the store, not sliced here.** `findTransfers` is a wrapper over `paginate`,
	 * and `paginate` reads a stated `skip` as a page *number* — it multiplies it by `take` before the
	 * query runs — so a row offset handed to it would answer a different page than the cursor named: a
	 * walk that repeats rows and skips others, with nothing red anywhere. The service's own row-offset
	 * read is `findAll`, which is what a connection's window states, so the page and its `totalCount`
	 * come from one query and the count is the size of the filtered set rather than of the page.
	 */
	@Query('stockTransfers')
	@Permissions(InventoryPermission.STOCK_TRANSFER_VIEW as PermissionsEnum)
	@Versioned({ write: false })
	async stockTransfers(
		@Args('status') status: StockTransferStatus,
		@Args('page', { type: () => Object, nullable: true }) page?: IConnectionPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	): Promise<GraphqlConnection<StockTransfer>> {
		const { skip, take } = resolveConnectionWindow(page);
		const listing = (await this.service.findAll({
			where: { status },
			skip,
			take,
			...(withDeleted ? { withDeleted: true } : {})
		})) as IPagination<StockTransfer>;

		return connectionFromOffsetPage(listing, skip);
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
	 * Edits a transfer's own fields.
	 *
	 * The field was declared in the composed schema with nothing bound to it, so a document that
	 * selected it passed validation and then failed with `Cannot return null for non-nullable field
	 * Mutation.updateStockTransfer`. It is bound to the same service method the REST route calls and
	 * carries the permission that route carries, so the two protocols ask the caller for the same
	 * thing.
	 *
	 * The field states no version, because the field declares none to state: the REST route reads one
	 * from `If-Match` and a GraphQL field would have to carry it beside the input it qualifies. The
	 * edit is still conditional — `commitTransition` predicates the `UPDATE` on the version it read
	 * inside the transaction and refuses a document another writer moved in between — so a concurrent
	 * edit is reported as the conflict it is rather than silently landing on top of one.
	 */
	@Mutation('updateStockTransfer')
	@Permissions(InventoryPermission.STOCK_TRANSFER_CREATE as PermissionsEnum)
	async updateStockTransfer(@Args('id') id: string, @Args('note') note: string): Promise<any> {
		return await this.service.update(id, { note } as never);
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
