/**
 * GraphQL resolver of the StockTransfer resource.
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
import { StockTransfer } from './../stock-transfer/stock-transfer.entity';
import { StockTransferService } from './../stock-transfer/stock-transfer.service';
import { StockTransferChangedEvent } from './../events';

@Resolver('StockTransfer')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
export class StockTransferResolver {
	constructor(
		private readonly service: StockTransferService,
		private readonly eventBus: EventBus
	) {}

	/** Transfers, filtered by state. */
	@Query('stockTransfers')
	@Permissions(InventoryPermission.STOCK_TRANSFER_VIEW as PermissionsEnum)
	async stockTransfers(@Args('status') status: string): Promise<any> {
		return await this.service.findTransfers({ where: { status } });
	}

	/** One transfer with its lines. */
	@Query('stockTransfer')
	@Permissions(InventoryPermission.STOCK_TRANSFER_VIEW as PermissionsEnum)
	async stockTransfer(@Args('id') id: string): Promise<any> {
		return await this.service.findOneByIdString(id, { relations: ["lines"] });
	}

	/** Drafts a transfer and numbers it. */
	@Mutation('createStockTransfer')
	@Permissions(InventoryPermission.STOCK_TRANSFER_CREATE as PermissionsEnum)
	async createStockTransfer(@Args('input') input: any): Promise<any> {
		return await this.service.createTransfer(input);
	}

	/** Dispatches a transfer and writes the outbound movements. */
	@Mutation('shipStockTransfer')
	@Permissions(InventoryPermission.STOCK_TRANSFER_SHIP as PermissionsEnum)
	async shipStockTransfer(@Args('id') id: string, @Args('lines') lines: any[]): Promise<any> {
		return await this.service.ship(id, lines);
	}

	/** Receives a transfer and writes the inbound movements. */
	@Mutation('receiveStockTransfer')
	@Permissions(InventoryPermission.STOCK_TRANSFER_RECEIVE as PermissionsEnum)
	async receiveStockTransfer(@Args('id') id: string, @Args('lines') lines: any[]): Promise<any> {
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
