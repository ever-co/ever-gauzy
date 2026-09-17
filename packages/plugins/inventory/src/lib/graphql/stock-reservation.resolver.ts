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
import { EventBus, Permissions, PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
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
	async stockReservations(@Args('referenceType') referenceType: StockReservationReferenceType, @Args('referenceId') referenceId: string, @Args('status') status: StockReservationStatus): Promise<any> {
		return await this.service.findReservations({ where: { referenceType, referenceId, status } });
	}

	/** One hold. */
	@Query('stockReservation')
	@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
	async stockReservation(@Args('id') id: string): Promise<any> {
		return await this.service.findOneByIdString(id);
	}

	/** Holds stock for a document. */
	@Mutation('createStockReservation')
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	async createStockReservation(@Args('input') input: any): Promise<any> {
		return await this.service.reserve(input);
	}

	/** Releases a hold without the stock leaving. */
	@Mutation('releaseStockReservation')
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	async releaseStockReservation(@Args('id') id: string, @Args('reason') reason: string): Promise<any> {
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
