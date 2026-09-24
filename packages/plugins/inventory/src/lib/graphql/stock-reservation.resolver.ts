/**
 * GraphQL resolver of the StockReservation resource.
 *
 * It delegates to the same service the REST controller uses, so both protocols answer from one
 * implementation and a permission declared here is the permission the REST route carries. The
 * resolver is schema-first, matching the platform’s existing resolvers: the schema literal declares
 * the types and this class binds them to the service.
 */
import { Args, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import { BadRequestException, UseGuards } from '@nestjs/common';
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
import { StockReservationReferenceType, StockReservationStatus } from './../inventory.enums';
import { StockReservation } from './../stock-reservation/stock-reservation.entity';
import { StockReservationService } from './../stock-reservation/stock-reservation.service';
import { StockReservationChangedEvent } from './../events';
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
@Resolver('StockReservation')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
export class StockReservationResolver {
	constructor(
		private readonly service: StockReservationService,
		private readonly eventBus: EventBus
	) {}

	/**
	 * Holds, filtered by the document that owns them, as a page a cursor can walk.
	 *
	 * **The window is read in the store, not sliced here.** `findReservations` is a wrapper over
	 * `paginate`, and `paginate` reads a stated `skip` as a page *number* — it multiplies it by `take`
	 * before the query runs — so a row offset handed to it would answer a different page than the cursor
	 * named: a walk that repeats rows and skips others, with nothing red anywhere. The service's own
	 * row-offset read is `findAll`, which is what a connection's window states, so the page and its
	 * `totalCount` come from one query and the count is the size of the filtered set rather than of the
	 * page.
	 */
	@Query('stockReservations')
	@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
	@Versioned({ write: false })
	async stockReservations(
		@Args('referenceType') referenceType: StockReservationReferenceType,
		@Args('referenceId') referenceId: string,
		@Args('status') status: StockReservationStatus,
		@Args('page', { type: () => Object, nullable: true }) page?: IConnectionPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	): Promise<GraphqlConnection<StockReservation>> {
		const { skip, take } = resolveConnectionWindow(page);
		const listing = (await this.service.findAll({
			where: { referenceType, referenceId, status },
			skip,
			take,
			...(withDeleted ? { withDeleted: true } : {})
		})) as IPagination<StockReservation>;

		return connectionFromOffsetPage(listing, skip);
	}

	/** One hold. */
	@Query('stockReservation')
	@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
	@Versioned({ write: false })
	async stockReservation(@Args('id') id: string): Promise<any> {
		return await this.service.findOneByIdString(id);
	}

	/**
	 * Holds stock for a document.
	 *
	 * The same operation the REST route serves, with the same version convention and the same key
	 * scope: the version the caller read the level at is required, because whether the hold fits is
	 * decided from that level, and a key already used for this operation is replayed rather than
	 * reserving the units twice.
	 */
	@Mutation('createStockReservation')
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	@Versioned({ target: STOCK_LEVEL_VERSION_TARGET })
	@Idempotent({ scope: 'stock.reservation.create', required: false, resourceType: 'stock-reservation' })
	async createStockReservation(@Args('input') input: any): Promise<any> {
		return await this.service.reserve(input);
	}

	/**
	 * Releases a hold without the stock leaving.
	 *
	 * The release credits the reserved quantity back to the level, so a caller that read the level may
	 * state its version; a caller that states none is still protected by the compare-and-set the
	 * release is written under and by the hold's own status, which refuses a second release.
	 */
	@Mutation('releaseStockReservation')
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	@Versioned({ required: false, target: STOCK_LEVEL_VERSION_TARGET })
	@Idempotent({ scope: 'stock.reservation.release', required: false, resourceType: 'stock-reservation' })
	async releaseStockReservation(
		@Args('id') id: string,
		@Args('reason') reason: string,
		@Args('idempotencyKey', { type: () => String, nullable: true }) idempotencyKey: string
	): Promise<any> {
		void idempotencyKey;

		return await this.service.release(id, reason);
	}

	/**
	 * Consumes a hold: the held units leave, and the hold closes with them.
	 *
	 * The field was declared in the composed schema with nothing bound to it, so a document that
	 * selected it passed validation and then failed with `Cannot return null for non-nullable field
	 * Mutation.consumeStockReservation`. It is bound here to the service method the status vocabulary
	 * already described — `CONSUMED` is "the stock actually left; a matching movement was written in
	 * the same transaction" — and carries the permission and the conventions the release beside it
	 * carries: the version is optional, because the compare-and-set the movement is written under is
	 * the guarantee, and a key already used for this operation is replayed rather than removing the
	 * units twice.
	 */
	@Mutation('consumeStockReservation')
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	@Versioned({ required: false, target: STOCK_LEVEL_VERSION_TARGET })
	@Idempotent({ scope: 'stock.reservation.consume', required: false, resourceType: 'stock-reservation' })
	async consumeStockReservation(@Args('id') id: string): Promise<any> {
		return await this.service.consume(id);
	}

	/**
	 * Pushes the expiry of every active hold of a document.
	 *
	 * The route it mirrors is `POST /stock-reservations/:id/extend`, and the field mirrors the argument
	 * order the route actually calls with rather than the order its path suggests: the service takes the
	 * *kind* before the *document*, and the path member is the document. The kind is a narrowing — a
	 * caller that states none is answered for every active hold of that document — which is what the
	 * route's own summary says it does and what it could not do while it was passing the document id as
	 * the kind as well.
	 *
	 * The instant is validated here exactly as the route validates it, with the same refusal code: an
	 * unparseable value written into `expiresAt` makes a hold the expiry sweep can never select and that
	 * no comparison can order, so both surfaces refuse it rather than storing it. The route declares no
	 * retry scope and no version expectation, and the field declares neither; the service's own clamping
	 * of the instant is the service's, and is reached identically from both sides.
	 *
	 * @param id The document whose holds are pushed out.
	 * @param expiresAt The new expiry, as an ISO-8601 instant.
	 * @param referenceType The kind of document, when the caller narrows it to one.
	 * @returns How many holds were extended.
	 */
	@Mutation('extendStockReservation')
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	async extendStockReservation(
		@Args('id') id: string,
		@Args('expiresAt') expiresAt: string,
		@Args('referenceType') referenceType?: StockReservationReferenceType
	): Promise<number> {
		const instant = new Date(expiresAt);

		if (!expiresAt || Number.isNaN(instant.getTime())) {
			throw new BadRequestException(
				'STOCK_RESERVATION_EXPIRY_INVALID: `expiresAt` states the instant a hold is pushed out to, as an ISO-8601 date and time.'
			);
		}

		return await this.service.extend(referenceType as StockReservationReferenceType, id, instant);
	}

	/**
	 * Emitted whenever a hold is created, released, consumed or expired.
	 *
	 * Declared so a client subscribes instead of polling. The stream is the platform’s event bus, so a
	 * subscriber sees exactly the events the domain already publishes for its outbox.
	 */
	@Subscription('stockReservationChanged')
	stockReservationChanged(@Args('referenceId') referenceId: string): any {
		return this.eventBus.ofType(StockReservationChangedEvent).pipe(map((event) => event.reservation));
	}
}
