/**
 * GraphQL resolver of the StockTransferLine resource.
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
import { StockTransferLine } from './../stock-transfer-line/stock-transfer-line.entity';
import { StockTransferLineService } from './../stock-transfer-line/stock-transfer-line.service';

@Resolver('StockTransferLine')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
export class StockTransferLineResolver {
	constructor(
		private readonly service: StockTransferLineService
	) {}

	/** The lines of a transfer. */
	@Query('stockTransferLines')
	@Permissions(InventoryPermission.STOCK_TRANSFER_VIEW as PermissionsEnum)
	async stockTransferLines(@Args('transferId') transferId: string): Promise<any> {
		return await this.service.findLines({ where: { transferId } });
	}

	/** One transfer line. */
	@Query('stockTransferLine')
	@Permissions(InventoryPermission.STOCK_TRANSFER_VIEW as PermissionsEnum)
	async stockTransferLine(@Args('id') id: string): Promise<any> {
		return await this.service.findOneByIdString(id);
	}

	/** Adds a variant to a draft transfer. */
	@Mutation('addStockTransferLine')
	@Permissions(InventoryPermission.STOCK_TRANSFER_CREATE as PermissionsEnum)
	async addStockTransferLine(@Args('input') input: any): Promise<any> {
		return await this.service.addLine(input);
	}
}
