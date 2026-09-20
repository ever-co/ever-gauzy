/**
 * GraphQL resolver of the StockReservation resource.
 *
 * It delegates to the same service the REST controller uses, so both protocols answer from one
 * implementation and a permission declared here is the permission the REST route carries. The
 * resolver is schema-first, matching the platform’s existing resolvers: the schema literal declares
 * the types and this class binds them to the service.
 */
import { Args, ID, Int, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { map } from 'rxjs/operators';
import { PermissionsEnum } from '@gauzy/contracts';
import { EventBus, Idempotent, Permissions, PermissionGuard, TenantPermissionGuard, Versioned } from '@gauzy/core';
import { InventoryPermission } from './../inventory.permissions';
import { StockReservationReferenceType, StockReservationStatus } from './../inventory.enums';
import { StockReservation } from './../stock-reservation/stock-reservation.entity';
import { StockReservationService } from './../stock-reservation/stock-reservation.service';
import { StockReservationChangedEvent } from './../events';

@Resolver('StockReservation')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
export class StockReservationResolver {
	constructor(
		private readonly service: StockReservationService,
		private readonly eventBus: EventBus
	) {}

	/** Holds, filtered by the document that owns them. */
	@Query('stockReservations')
	@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
	@Versioned({ write: false })
	async stockReservations(@Args('referenceType') referenceType: StockReservationReferenceType, @Args('referenceId') referenceId: string, @Args('status') status: StockReservationStatus): Promise<any> {
		return await this.service.findReservations({ where: { referenceType, referenceId, status } });
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
	@Versioned()
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
	@Versioned({ required: false })
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
