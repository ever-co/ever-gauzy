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
import { EventBus, FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { InventoryPermission } from './../inventory.permissions';
import { StockCountLine } from './../stock-count-line/stock-count-line.entity';
import { StockCountLineService } from './../stock-count-line/stock-count-line.service';

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
@Resolver('StockCountLine')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
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
