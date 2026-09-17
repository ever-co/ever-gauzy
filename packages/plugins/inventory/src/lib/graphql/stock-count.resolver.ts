/**
 * GraphQL resolver of the StockCount resource.
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
import { StockCount } from './../stock-count/stock-count.entity';
import { StockCountService } from './../stock-count/stock-count.service';

@Resolver('StockCount')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
export class StockCountResolver {
	constructor(
		private readonly service: StockCountService
	) {}

	/** Count sessions. */
	@Query('stockCounts')
	@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
	async stockCounts(@Args('warehouseId') warehouseId: string, @Args('status') status: string, @Args('mode') mode: string): Promise<any> {
		return await this.service.findCounts({ where: { warehouseId, status, mode } });
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

	/** Records a batch of readings. */
	@Mutation('recordStockCountLine')
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	async recordStockCountLine(@Args('id') id: string, @Args('lines') lines: any[]): Promise<any> {
		return await this.service.recordLines(id, lines);
	}

	/** Closes the session and writes its corrections. */
	@Mutation('closeStockCount')
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	async closeStockCount(@Args('id') id: string): Promise<any> {
		return await this.service.close(id).then((result) => result.count);
	}
}
