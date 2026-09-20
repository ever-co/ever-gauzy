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
import {
	EventBus,
	FeatureFlagGuard,
	Idempotent,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	Versioned
} from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { InventoryPermission } from './../inventory.permissions';
import { StockAdjustmentStatus } from './../inventory.enums';
import { StockAdjustment } from './../stock-adjustment/stock-adjustment.entity';
import { StockAdjustmentService } from './../stock-adjustment/stock-adjustment.service';

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
@Resolver('StockAdjustment')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
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
