/**
 * GraphQL resolver of the StockCount resource.
 *
 * It delegates to the same service the REST controller uses, so both protocols answer from one
 * implementation and a permission declared here is the permission the REST route carries. The
 * resolver is schema-first, matching the platform’s existing resolvers: the schema literal declares
 * the types and this class binds them to the service.
 */
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { PermissionsEnum } from '@gauzy/contracts';
import {
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
import { StockCountMode, StockCountStatus } from './../inventory.enums';
import { StockCount } from './../stock-count/stock-count.entity';
import { StockCountService } from './../stock-count/stock-count.service';

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
@Resolver('StockCount')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
export class StockCountResolver {
	constructor(
		private readonly service: StockCountService
	) {}

	/** Count sessions. */
	@Query('stockCounts')
	@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
	async stockCounts(@Args('warehouseId') warehouseId: string, @Args('status') status: StockCountStatus, @Args('mode') mode: StockCountMode): Promise<any> {
		const page = await this.service.findCounts({ where: { warehouseId, status, mode } });

		// The service answers a page, and the schema declares a list: a method that already
		// answers one is returned as it is, so this holds either way.
		return Array.isArray(page) ? page : (page as any)?.items ?? [];
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

	/**
	 * Records a batch of readings.
	 *
	 * The readings are a write on the session and not on the levels — nothing moves until the session
	 * closes — so this mutation carries the key and not the version, with the same scope the REST route
	 * declares. A retry that recorded the same readings twice would double-count a batch of the
	 * variance.
	 */
	@Mutation('recordStockCountLine')
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	@Idempotent({ scope: 'stock.count', required: false, resourceType: 'stock-count' })
	async recordStockCountLine(
		@Args('id') id: string,
		@Args('lines') lines: any[],
		@Args('idempotencyKey', { type: () => String, nullable: true }) idempotencyKey: string
	): Promise<any> {
		void idempotencyKey;

		return await this.service.recordLines(id, lines);
	}

	/**
	 * Closes the session and writes its corrections.
	 *
	 * The corrections land on the levels of the lines the session covers, so the version is optional
	 * for the reason the REST route states it optionally — a stated version is honoured for the level
	 * it names and the compare-and-set covers the rest — and the key makes a retry of the close replay
	 * rather than write a second set of corrections.
	 */
	@Mutation('closeStockCount')
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	@Versioned({ required: false })
	@Idempotent({ scope: 'stock.count', required: false, resourceType: 'stock-count' })
	async closeStockCount(
		@Args('id') id: string,
		@Args('idempotencyKey', { type: () => String, nullable: true }) idempotencyKey: string
	): Promise<any> {
		void idempotencyKey;

		return await this.service.close(id).then((result) => result.count);
	}
}
