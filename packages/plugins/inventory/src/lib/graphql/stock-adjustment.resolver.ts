/**
 * GraphQL resolver of the StockAdjustment resource.
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
import { StockAdjustmentStatus } from './../inventory.enums';
import { StockAdjustment } from './../stock-adjustment/stock-adjustment.entity';
import { StockAdjustmentService } from './../stock-adjustment/stock-adjustment.service';

@Resolver('StockAdjustment')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
export class StockAdjustmentResolver {
	constructor(
		private readonly service: StockAdjustmentService
	) {}

	/** Manual correction instructions. */
	@Query('stockAdjustments')
	@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
	@Versioned({ write: false })
	async stockAdjustments(@Args('warehouseId') warehouseId: string, @Args('variantId') variantId: string, @Args('status') status: StockAdjustmentStatus): Promise<any> {
		return await this.service.findAdjustments({ where: { warehouseId, variantId, status } });
	}

	/** Drafts a manual correction. */
	@Mutation('adjustStock')
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	async adjustStock(@Args('input') input: any): Promise<any> {
		return await this.service.createAdjustment(input);
	}

	/**
	 * Applies a drafted correction and writes its ledger row.
	 *
	 * The same operation the REST route serves, with the same version convention and the same key
	 * scope: the version the caller read is required — the correction is decided from the level it
	 * read — and a key already used for this operation is replayed rather than applied twice. The key
	 * is the resolver's own argument because this mutation has no input object to carry it, which is
	 * the second spelling the platform's retry-safety convention reads.
	 */
	@Mutation('applyStockAdjustment')
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	@Versioned()
	@Idempotent({ scope: 'stock.adjust', required: false, resourceType: 'stock-adjustment' })
	async applyStockAdjustment(
		@Args('id') id: string,
		@Args('idempotencyKey', { type: () => String, nullable: true }) idempotencyKey: string
	): Promise<any> {
		void idempotencyKey;

		return await this.service.apply(id).then((result) => ({ ...result.adjustment, version: result.version }));
	}
}
