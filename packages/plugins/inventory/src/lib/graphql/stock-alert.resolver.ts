/**
 * GraphQL resolver of the StockAlert resource.
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
import { EventBus, Idempotent, Permissions, PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { InventoryPermission } from './../inventory.permissions';
import { StockAlert } from './../stock-alert/stock-alert.entity';
import { StockAlertService } from './../stock-alert/stock-alert.service';

@Resolver('StockAlert')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
export class StockAlertResolver {
	constructor(
		private readonly service: StockAlertService
	) {}

	/** Alert rules. */
	@Query('stockAlerts')
	@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
	async stockAlerts(@Args('variantId') variantId: string, @Args('isActive') isActive: boolean): Promise<any> {
		return await this.service.findAlerts({ where: { variantId, isActive } });
	}

	/**
	 * Creates a rule.
	 *
	 * The key is the input member the REST route's header mirrors: a rule a client retried after losing
	 * the response is replayed rather than created a second time under a new threshold.
	 */
	@Mutation('createStockAlert')
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	@Idempotent({ scope: 'stock.alert.create', required: false, resourceType: 'stock-alert' })
	async createStockAlert(@Args('input') input: any): Promise<any> {
		return await this.service.createAlert(input);
	}

	/** Updates a rule. */
	@Mutation('updateStockAlert')
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	async updateStockAlert(@Args('id') id: string, @Args('input') input: any): Promise<any> {
		return await this.service.update(id, input);
	}

	/** Deletes a rule. */
	@Mutation('deleteStockAlert')
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	async deleteStockAlert(@Args('id') id: string): Promise<any> {
		return await this.service.delete(id).then(() => true);
	}
}
