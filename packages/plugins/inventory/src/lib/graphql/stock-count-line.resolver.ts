/**
 * GraphQL resolver of the StockCountLine resource.
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
import { StockCountLine } from './../stock-count-line/stock-count-line.entity';
import { StockCountLineService } from './../stock-count-line/stock-count-line.service';

@Resolver('StockCountLine')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
export class StockCountLineResolver {
	constructor(
		private readonly service: StockCountLineService
	) {}

	/** The lines of a count session. */
	@Query('stockCountLines')
	@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
	async stockCountLines(@Args('stockCountId') stockCountId: string): Promise<any> {
		return await this.service.findLines({ where: { stockCountId } });
	}

	/** One count line. */
	@Query('stockCountLine')
	@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
	async stockCountLine(@Args('id') id: string): Promise<any> {
		return await this.service.findOneByIdString(id);
	}

	/** The variance of a session, in units and valued at the recorded unit cost. */
	@Query('stockCountVariance')
	@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
	async stockCountVariance(@Args('stockCountId') stockCountId: string): Promise<any> {
		return await this.service.varianceOf(stockCountId);
	}
}
