import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ID } from '@gauzy/contracts';
import { FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { WarehouseBinService } from '../../warehouse-bin/warehouse-bin.service';
import { WarehouseBin } from '../../warehouse-bin/warehouse-bin.entity';
import { WarehouseFeatures } from '../../warehouse.features';
import { WarehousePermissions } from '../../warehouse.permissions';
import { IWarehouseZone, WarehouseZoneType } from '../../warehouse.types';
import { WarehouseZone } from '../../warehouse-zone/warehouse-zone.entity';
import { WarehouseZoneService } from '../../warehouse-zone/warehouse-zone.service';
import { buildConnection, IPageSelection, resolveWindow } from '../pagination';
import { toUserError } from '../wire';

/** The request that defines a zone, as the schema declares it. */
interface IWarehouseZoneInput {
	warehouseId?: ID;
	name?: string;
	code?: string;
	type?: WarehouseZoneType;
	priority?: number;
	isPickable?: boolean;
	isReceivable?: boolean;
	isShippable?: boolean;
	isBlocked?: boolean;
	minTemperature?: string;
	maxTemperature?: string;
	metadata?: Record<string, unknown>;
}

/**
 * The zones of a stock location.
 *
 * The resolvers call the same services the REST surface calls, so a zone created over GraphQL and one
 * created over REST obey the same visiting-order and temperature rules, and the two surfaces cannot
 * drift. Authorisation is unchanged: the same guards and the same permission values run on the HTTP
 * request that carried the operation.
 *
 * **The gate is the catalogue's, and the domain code stands beside it.** `FeatureFlagGuard` reads one
 * code per target — `getAllAndOverride` over the handler and then the class — so the code stated first
 * on the class is the one that gates every field below, and it is `FEATURE_GRAPHQL`, the commerce
 * catalogue's entry for "the GraphQL endpoint and its resolvers, under the same guards and permissions
 * as REST": a tenant that switched the GraphQL surface off is answered the refusal a disabled
 * capability's routes answer with a 404, which is the hole this statement closes. `WarehouseFeatures.WAREHOUSE`
 * stays written below it because the warehouse capability is what the routes serving the same resources
 * carry and what this plugin's own feature catalogue declares, so a reader comparing the two surfaces
 * sees it; it is a record rather than a second check, because the feature metadata carries one value per
 * target, and a class that needs both codes checked needs `FeatureFlagGuard` to resolve a set of them —
 * a change to `packages/core/src/lib/shared/guards/feature-flag.guard.ts`, not to this file.
 */
@Resolver('WarehouseZone')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@FeatureFlag(WarehouseFeatures.WAREHOUSE)
export class WarehouseZoneResolver {
	constructor(
		private readonly warehouseZoneService: WarehouseZoneService,
		private readonly warehouseBinService: WarehouseBinService
	) {}

	/**
	 * Lists zones.
	 *
	 * @param filter The zone filter.
	 * @param page The page.
	 * @param withDeleted Whether the retired zones are included.
	 * @returns One page of zones.
	 */
	@Permissions(WarehousePermissions.WAREHOUSE_ZONES_VIEW)
	@Query('warehouseZones')
	async warehouseZones(
		@Args('filter') filter?: {
			warehouseId?: ID;
			type?: WarehouseZoneType;
			code?: string;
			isPickable?: boolean;
			isBlocked?: boolean;
		},
		@Args('page') page?: IPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	) {
		const { skip, take } = resolveWindow(page);
		const result = await this.warehouseZoneService.findAll({
			where: {
				...(filter?.warehouseId ? { warehouseId: filter.warehouseId } : {}),
				...(filter?.type ? { type: filter.type } : {}),
				...(filter?.code ? { code: filter.code } : {}),
				...(filter?.isPickable !== undefined ? { isPickable: filter.isPickable } : {}),
				...(filter?.isBlocked !== undefined ? { isBlocked: filter.isBlocked } : {})
			},
			skip,
			take,
			order: { priority: 'ASC', code: 'ASC' },
			...(withDeleted ? { withDeleted: true } : {})
		} as any);

		return buildConnection(result, skip);
	}

	/**
	 * Reads one zone.
	 *
	 * @param id The zone.
	 * @returns The zone, or null when it is not the caller's.
	 */
	@Permissions(WarehousePermissions.WAREHOUSE_ZONES_VIEW)
	@Query('warehouseZone')
	async warehouseZone(@Args('id') id: ID): Promise<WarehouseZone | null> {
		try {
			return await this.warehouseZoneService.findOneDetailed(id);
		} catch (error) {
			return null;
		}
	}

	/**
	 * Creates a zone.
	 *
	 * @param input The zone.
	 * @returns The payload, with the zone or the reason it was refused.
	 */
	@Permissions(WarehousePermissions.WAREHOUSE_ZONES_CREATE)
	@Mutation('createWarehouseZone')
	async createWarehouseZone(@Args('input') input: IWarehouseZoneInput) {
		try {
			return { warehouseZone: await this.warehouseZoneService.create(input as any), userErrors: [] };
		} catch (error) {
			return { warehouseZone: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Updates a zone.
	 *
	 * @param id The zone.
	 * @param input The fields to change.
	 * @returns The payload.
	 */
	@Permissions(WarehousePermissions.WAREHOUSE_ZONES_EDIT)
	@Mutation('updateWarehouseZone')
	async updateWarehouseZone(@Args('id') id: ID, @Args('input') input: IWarehouseZoneInput) {
		try {
			return { warehouseZone: await this.warehouseZoneService.update(id, input as any), userErrors: [] };
		} catch (error) {
			return { warehouseZone: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Rewrites the walking order of a location's zones.
	 *
	 * @param warehouseId The location.
	 * @param zones The zones and their new positions.
	 * @returns The zones in their new order.
	 */
	@Permissions(WarehousePermissions.WAREHOUSE_ZONES_EDIT)
	@Mutation('reorderWarehouseZones')
	async reorderWarehouseZones(
		@Args('warehouseId') warehouseId: ID,
		@Args('zones') zones: Array<{ id: ID; priority: number }>
	): Promise<WarehouseZone[]> {
		return await this.warehouseZoneService.reorder(warehouseId, zones);
	}

	/**
	 * Blocks a zone, or puts it back into service.
	 *
	 * @param id The zone.
	 * @param isBlocked Whether the area is out of service.
	 * @returns The payload.
	 */
	@Permissions(WarehousePermissions.WAREHOUSE_ZONES_EDIT)
	@Mutation('setWarehouseZoneBlocked')
	async setWarehouseZoneBlocked(@Args('id') id: ID, @Args('isBlocked') isBlocked: boolean) {
		try {
			return { warehouseZone: await this.warehouseZoneService.setBlocked(id, isBlocked), userErrors: [] };
		} catch (error) {
			return { warehouseZone: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Deletes a zone that holds no bin.
	 *
	 * @param id The zone.
	 * @returns The payload.
	 */
	@Permissions(WarehousePermissions.WAREHOUSE_ZONES_DELETE)
	@Mutation('deleteWarehouseZone')
	async deleteWarehouseZone(@Args('id') id: ID) {
		try {
			await this.warehouseZoneService.delete(id);

			return { warehouseZone: null, userErrors: [] };
		} catch (error) {
			return { warehouseZone: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Retires a zone recoverably, keeping the area and everything addressed inside it.
	 *
	 * The route it mirrors is `DELETE /warehouse-zones/:id/soft`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. Without this field
	 * a zone a caller took out of service over GraphQL could not be put back over GraphQL, while a REST
	 * caller could do both — and the hard delete the endpoint does serve is refused for any zone that still
	 * holds a bin, which is exactly the case a caller reaches for the soft route on.
	 *
	 * The permission is the controller's own for the route — `WAREHOUSE_ZONES_DELETE` — and not the
	 * class-level view grant, because retiring a zone takes its positions out of the pick path.
	 *
	 * @param id The zone to retire.
	 * @returns The payload, with the retired zone or the reason it was refused.
	 */
	@Permissions(WarehousePermissions.WAREHOUSE_ZONES_DELETE)
	@Mutation('softDeleteWarehouseZone')
	async softDeleteWarehouseZone(@Args('id') id: ID) {
		try {
			return { warehouseZone: await this.warehouseZoneService.softRemove(id), userErrors: [] };
		} catch (error) {
			return { warehouseZone: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Restores a zone that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /warehouse-zones/:id/recover`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. A restored zone is
	 * walked again by pick-path generation, which is why the route states the deleting grant rather than
	 * the reading one.
	 *
	 * @param id The zone to restore.
	 * @returns The payload, with the restored zone or the reason it was refused.
	 */
	@Permissions(WarehousePermissions.WAREHOUSE_ZONES_DELETE)
	@Mutation('recoverWarehouseZone')
	async recoverWarehouseZone(@Args('id') id: ID) {
		try {
			return { warehouseZone: await this.warehouseZoneService.softRecover(id), userErrors: [] };
		} catch (error) {
			return { warehouseZone: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Resolves the positions inside a zone.
	 *
	 * @param zone The zone being read.
	 * @returns The bins.
	 */
	@Permissions(WarehousePermissions.WAREHOUSE_ZONES_VIEW)
	@ResolveField('bins')
	async bins(@Parent() zone: IWarehouseZone): Promise<WarehouseBin[]> {
		if (Array.isArray((zone as WarehouseZone).bins)) {
			return (zone as WarehouseZone).bins;
		}

		return await this.warehouseBinService.findInZone(zone.id);
	}
}
