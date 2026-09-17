import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ID } from '@gauzy/contracts';
import { FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FeatureFlag } from '@gauzy/common';
import { WarehouseBin } from '../../warehouse-bin/warehouse-bin.entity';
import { WarehouseBinService } from '../../warehouse-bin/warehouse-bin.service';
import { WarehouseZone } from '../../warehouse-zone/warehouse-zone.entity';
import { WarehouseZoneService } from '../../warehouse-zone/warehouse-zone.service';
import { WarehouseFeatures } from '../../warehouse.features';
import { WarehousePermissions } from '../../warehouse.permissions';
import { IWarehouseBin, IWarehouseBinCapacityCheck, WarehouseBinType } from '../../warehouse.types';
import { buildConnection, IPageSelection, resolveWindow } from '../pagination';
import { toUserError } from '../wire';

/** The request that defines a bin, as the schema declares it. */
interface IWarehouseBinInput {
	warehouseId?: ID;
	zoneId?: ID;
	parentId?: ID;
	code?: string;
	barcode?: string;
	type?: WarehouseBinType;
	isPickable?: boolean;
	isBlocked?: boolean;
	capacityUnits?: string;
	capacityUnitId?: ID;
	maxWeight?: string;
	maxWeightUnitId?: ID;
	maxVolume?: string;
	maxVolumeUnitId?: ID;
	aisle?: string;
	rack?: string;
	level?: string;
	position?: string;
	sortOrder?: number;
	metadata?: Record<string, unknown>;
}

/**
 * The positions inside a location.
 *
 * The hierarchy routes here are the interesting ones: moving a bin rewrites the closure table in the
 * same transaction as the row, and blocking one is how a position leaves rotation without pretending
 * the units in it are gone.
 */
@Resolver('WarehouseBin')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(WarehouseFeatures.WAREHOUSE)
export class WarehouseBinResolver {
	constructor(
		private readonly warehouseBinService: WarehouseBinService,
		private readonly warehouseZoneService: WarehouseZoneService
	) {}

	/**
	 * Lists bins.
	 *
	 * @param filter The bin filter.
	 * @param page The page.
	 * @returns One page of bins.
	 */
	@Permissions(WarehousePermissions.WAREHOUSE_BINS_VIEW)
	@Query('warehouseBins')
	async warehouseBins(
		@Args('filter') filter?: {
			warehouseId?: ID;
			zoneId?: ID;
			parentId?: ID;
			code?: string;
			type?: WarehouseBinType;
			isPickable?: boolean;
			isBlocked?: boolean;
		},
		@Args('page') page?: IPageSelection
	) {
		const { skip, take } = resolveWindow(page);
		const result = await this.warehouseBinService.findAll({
			where: {
				...(filter?.warehouseId ? { warehouseId: filter.warehouseId } : {}),
				...(filter?.zoneId ? { zoneId: filter.zoneId } : {}),
				...(filter?.parentId ? { parentId: filter.parentId } : {}),
				...(filter?.code ? { code: filter.code } : {}),
				...(filter?.type ? { type: filter.type } : {}),
				...(filter?.isPickable !== undefined ? { isPickable: filter.isPickable } : {}),
				...(filter?.isBlocked !== undefined ? { isBlocked: filter.isBlocked } : {})
			},
			skip,
			take,
			order: { sortOrder: 'ASC', code: 'ASC' }
		} as any);

		return buildConnection(result, skip);
	}

	/**
	 * Reads one bin.
	 *
	 * @param id The bin.
	 * @returns The bin, or null when it is not the caller's.
	 */
	@Permissions(WarehousePermissions.WAREHOUSE_BINS_VIEW)
	@Query('warehouseBin')
	async warehouseBin(@Args('id') id: ID): Promise<WarehouseBin | null> {
		try {
			return await this.warehouseBinService.findOneDetailed(id);
		} catch (error) {
			return null;
		}
	}

	/**
	 * Reads everything under a bin.
	 *
	 * @param id The root of the subtree.
	 * @returns The subtree, in walking order.
	 */
	@Permissions(WarehousePermissions.WAREHOUSE_BINS_VIEW)
	@Query('warehouseBinSubtree')
	async warehouseBinSubtree(@Args('id') id: ID): Promise<WarehouseBin[]> {
		return await this.warehouseBinService.findSubtree(id);
	}

	/**
	 * Reads the derived contents of a bin.
	 *
	 * @param id The bin.
	 * @returns One balance per variant the bin holds.
	 */
	@Permissions(WarehousePermissions.WAREHOUSE_BINS_VIEW)
	@Query('warehouseBinContents')
	async warehouseBinContents(@Args('id') id: ID) {
		return await this.warehouseBinService.findContents(id);
	}

	/**
	 * Measures a request against a bin's declared capacity.
	 *
	 * The answer is a warning rather than a refusal, because exceeding a planning limit is something a
	 * real warehouse does — and a bin whose capacity has no declared unit is reported instead of being
	 * compared, since a comparison of two numbers in unknown units answers nothing.
	 *
	 * @param input The bin, the requested quantity and the factor that converts it.
	 * @returns The comparison, with its notices.
	 */
	@Permissions(WarehousePermissions.WAREHOUSE_BINS_VIEW)
	@Query('warehouseBinCapacity')
	async warehouseBinCapacity(
		@Args('input') input: { binId: ID; quantity: string; unitId?: ID; conversionFactor?: string }
	): Promise<IWarehouseBinCapacityCheck> {
		return await this.warehouseBinService.checkCapacity(input);
	}

	/**
	 * Lists the bins whose capacity is declared without the unit it is counted in.
	 *
	 * @param warehouseId The location, when the caller wants one location only.
	 * @returns One entry per bin with an undeclared capacity unit, pallet positions first.
	 */
	@Permissions(WarehousePermissions.WAREHOUSE_BINS_VIEW)
	@Query('warehouseBinCapacityWarnings')
	async warehouseBinCapacityWarnings(@Args('warehouseId') warehouseId?: ID) {
		return await this.warehouseBinService.capacityWarnings(warehouseId);
	}

	/**
	 * Creates a bin.
	 *
	 * @param input The bin.
	 * @returns The payload.
	 */
	@Permissions(WarehousePermissions.WAREHOUSE_BINS_CREATE)
	@Mutation('createWarehouseBin')
	async createWarehouseBin(@Args('input') input: IWarehouseBinInput) {
		try {
			return { warehouseBin: await this.warehouseBinService.create(input as any), userErrors: [] };
		} catch (error) {
			return { warehouseBin: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Creates a consecutive range of bins.
	 *
	 * @param input The range.
	 * @returns The payload.
	 */
	@Permissions(WarehousePermissions.WAREHOUSE_BINS_CREATE)
	@Mutation('createWarehouseBinRange')
	async createWarehouseBinRange(
		@Args('input')
		input: {
			warehouseId: ID;
			zoneId?: ID;
			parentId?: ID;
			from: string;
			count: number;
			type?: WarehouseBinType;
			isPickable?: boolean;
			sortOrder?: number;
		}
	) {
		try {
			return { warehouseBins: await this.warehouseBinService.createRange(input), userErrors: [] };
		} catch (error) {
			return { warehouseBins: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Updates a bin.
	 *
	 * @param id The bin.
	 * @param input The fields to change.
	 * @returns The payload.
	 */
	@Permissions(WarehousePermissions.WAREHOUSE_BINS_EDIT)
	@Mutation('updateWarehouseBin')
	async updateWarehouseBin(@Args('id') id: ID, @Args('input') input: IWarehouseBinInput) {
		try {
			return { warehouseBin: await this.warehouseBinService.update(id, input as any), userErrors: [] };
		} catch (error) {
			return { warehouseBin: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Moves a bin and its subtree inside its zone.
	 *
	 * @param id The bin.
	 * @param parentId The new parent, or null to make it a root.
	 * @returns The payload.
	 */
	@Permissions(WarehousePermissions.WAREHOUSE_BINS_EDIT)
	@Mutation('reparentWarehouseBin')
	async reparentWarehouseBin(@Args('id') id: ID, @Args('parentId') parentId?: ID) {
		try {
			return { warehouseBin: await this.warehouseBinService.reparent(id, parentId ?? null), userErrors: [] };
		} catch (error) {
			return { warehouseBin: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Blocks a bin, or puts it back into service.
	 *
	 * @param id The bin.
	 * @param isBlocked Whether the position is out of service.
	 * @returns The payload.
	 */
	@Permissions(WarehousePermissions.WAREHOUSE_BINS_EDIT)
	@Mutation('setWarehouseBinBlocked')
	async setWarehouseBinBlocked(@Args('id') id: ID, @Args('isBlocked') isBlocked: boolean) {
		try {
			return { warehouseBin: await this.warehouseBinService.setBlocked(id, isBlocked), userErrors: [] };
		} catch (error) {
			return { warehouseBin: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Deletes a bin that is empty and holds no position under it.
	 *
	 * @param id The bin.
	 * @returns The payload.
	 */
	@Permissions(WarehousePermissions.WAREHOUSE_BINS_DELETE)
	@Mutation('deleteWarehouseBin')
	async deleteWarehouseBin(@Args('id') id: ID) {
		try {
			await this.warehouseBinService.delete(id);

			return { warehouseBin: null, userErrors: [] };
		} catch (error) {
			return { warehouseBin: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Reconciles the bins of a location against the movement ledger.
	 *
	 * @param input The scope of the run and whether it should repair what it finds.
	 * @returns The payload, carrying the report.
	 */
	@Permissions(WarehousePermissions.WAREHOUSE_BINS_EDIT)
	@Mutation('reconcileWarehouseBins')
	async reconcileWarehouseBins(
		@Args('input') input: { warehouseId: ID; zoneId?: ID; binIds?: ID[]; repair?: boolean }
	) {
		try {
			return { report: await this.warehouseBinService.reconcile(input), userErrors: [] };
		} catch (error) {
			return { report: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Resolves the area a bin sits in.
	 *
	 * @param bin The bin being read.
	 * @returns The area, or null when the bin is filed under none.
	 */
	@Permissions(WarehousePermissions.WAREHOUSE_BINS_VIEW)
	@ResolveField('zone')
	async zone(@Parent() bin: IWarehouseBin): Promise<WarehouseZone | null> {
		if ((bin as WarehouseBin).zone) {
			return (bin as WarehouseBin).zone;
		}

		if (!bin.zoneId) {
			return null;
		}

		try {
			return await this.warehouseZoneService.findOneScoped(bin.zoneId);
		} catch (error) {
			return null;
		}
	}

	/**
	 * Resolves the parent of a bin.
	 *
	 * @param bin The bin being read.
	 * @returns The parent, or null when the bin is a root.
	 */
	@Permissions(WarehousePermissions.WAREHOUSE_BINS_VIEW)
	@ResolveField('parent')
	async parent(@Parent() bin: IWarehouseBin): Promise<WarehouseBin | null> {
		if (!bin.parentId) {
			return null;
		}

		try {
			return await this.warehouseBinService.findOneScoped(bin.parentId);
		} catch (error) {
			return null;
		}
	}

	/**
	 * Resolves the positions directly under a bin.
	 *
	 * @param bin The bin being read.
	 * @returns The children.
	 */
	@Permissions(WarehousePermissions.WAREHOUSE_BINS_VIEW)
	@ResolveField('children')
	async children(@Parent() bin: IWarehouseBin): Promise<WarehouseBin[]> {
		if (Array.isArray((bin as WarehouseBin).children)) {
			return (bin as WarehouseBin).children;
		}

		const subtree = await this.warehouseBinService.findSubtree(bin.id);

		return subtree.filter((candidate) => String(candidate.parentId ?? '') === String(bin.id));
	}
}
