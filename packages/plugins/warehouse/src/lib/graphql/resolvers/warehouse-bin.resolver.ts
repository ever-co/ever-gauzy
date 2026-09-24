import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ID } from '@gauzy/contracts';
import {
	FeatureFlagGuard,
	GraphqlConnection,
	IConnectionPageSelection,
	Idempotent,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	Versioned,
	connectionFromOffsetPage,
	paginateRows,
	resolveConnectionWindow
} from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { WarehouseBin } from '../../warehouse-bin/warehouse-bin.entity';
import { WarehouseBinService } from '../../warehouse-bin/warehouse-bin.service';
import { WarehouseZone } from '../../warehouse-zone/warehouse-zone.entity';
import { WarehouseZoneService } from '../../warehouse-zone/warehouse-zone.service';
import { WarehouseFeatures } from '../../warehouse.features';
import { WarehousePermissions } from '../../warehouse.permissions';
import {
	IWarehouseBin,
	IWarehouseBinBalance,
	IWarehouseBinCapacityCheck,
	WarehouseBinType,
	WAREHOUSE_LEVEL_VERSION_TARGET
} from '../../warehouse.types';
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
@Resolver('WarehouseBin')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
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
	 * @param withDeleted Whether the retired positions are included.
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
		@Args('page') page?: IPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
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
			order: { sortOrder: 'ASC', code: 'ASC' },
			...(withDeleted ? { withDeleted: true } : {})
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
	 * The traversal answers the whole subtree in walking order and takes no window of its own, so the page
	 * is cut here. Handing the window to a method that does not accept one is the failure this avoids: the
	 * field would answer the first page to every caller while its `pageInfo` claimed to describe the page
	 * that was asked for.
	 *
	 * @param id The root of the subtree.
	 * @param page The page.
	 * @param withDeleted Whether the retired positions are included.
	 * @returns One page of the subtree, in walking order.
	 * @throws for a page the query protocol refuses — both styles at once, both directions at once, a
	 * cursor this platform did not mint — which is deliberately not caught here, because answering a
	 * refusal with the first page hands a client rows it did not ask for.
	 */
	@Permissions(WarehousePermissions.WAREHOUSE_BINS_VIEW)
	@Query('warehouseBinSubtree')
	async warehouseBinSubtree(
		@Args('id') id: ID,
		@Args('page', { type: () => Object, nullable: true }) page?: IConnectionPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	): Promise<GraphqlConnection<WarehouseBin>> {
		const { skip, take } = resolveConnectionWindow(page);
		const rows = await this.warehouseBinService.findSubtree(id, withDeleted ? { withDeleted: true } : {});

		return connectionFromOffsetPage(paginateRows(rows, take, skip), skip);
	}

	/**
	 * Reads the derived contents of a bin.
	 *
	 * The capability answers one balance per variant the bin holds and pages nothing itself, so the page
	 * is cut here for the reason the subtree states, and the count the connection reports is the whole
	 * contents rather than the rows on this page.
	 *
	 * @param id The bin.
	 * @param page The page.
	 * @returns One page of balances, one per variant the bin holds.
	 * @throws for a page the query protocol refuses, which is deliberately not caught here.
	 */
	@Permissions(WarehousePermissions.WAREHOUSE_BINS_VIEW)
	@Query('warehouseBinContents')
	async warehouseBinContents(
		@Args('id') id: ID,
		@Args('page', { type: () => Object, nullable: true }) page?: IConnectionPageSelection
	): Promise<GraphqlConnection<IWarehouseBinBalance>> {
		const { skip, take } = resolveConnectionWindow(page);
		const rows = await this.warehouseBinService.findContents(id);

		return connectionFromOffsetPage(paginateRows(rows, take, skip), skip);
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
	 * @param idempotencyKey The key a retry presents, matching the REST route's scope.
	 * @returns The payload.
	 */
	@Permissions(WarehousePermissions.WAREHOUSE_BINS_EDIT)
	@Mutation('reparentWarehouseBin')
	@Idempotent({ scope: 'warehouse.move', required: false, resourceType: 'warehouse-bin' })
	async reparentWarehouseBin(
		@Args('id') id: ID,
		@Args('parentId') parentId?: ID,
		@Args('idempotencyKey', { type: () => String, nullable: true }) idempotencyKey?: string
	) {
		void idempotencyKey;

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
	 * Retires a bin recoverably, keeping its place in the hierarchy and the rows addressed to it.
	 *
	 * The route it mirrors is `DELETE /warehouse-bins/:id/soft`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. Without this field
	 * a position a caller retired over GraphQL could not be brought back over GraphQL — and the hard delete
	 * the endpoint does serve is refused for any bin that holds stock or has a position under it, which is
	 * precisely when the soft route is the one a caller wants.
	 *
	 * The permission is the controller's own for the route — `WAREHOUSE_BINS_DELETE` — and not the
	 * class-level view grant, because retiring a bin stops everything addressed to it resolving.
	 *
	 * @param id The bin to retire.
	 * @returns The payload, with the retired bin or the reason it was refused.
	 */
	@Permissions(WarehousePermissions.WAREHOUSE_BINS_DELETE)
	@Mutation('softDeleteWarehouseBin')
	async softDeleteWarehouseBin(@Args('id') id: ID) {
		try {
			return { warehouseBin: await this.warehouseBinService.softRemove(id), userErrors: [] };
		} catch (error) {
			return { warehouseBin: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Restores a bin that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /warehouse-bins/:id/recover`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. A restored bin is
	 * an address again — put-away walks into it and the pick path visits it — which is why the route
	 * states the deleting grant rather than the reading one.
	 *
	 * @param id The bin to restore.
	 * @returns The payload, with the restored bin or the reason it was refused.
	 */
	@Permissions(WarehousePermissions.WAREHOUSE_BINS_DELETE)
	@Mutation('recoverWarehouseBin')
	async recoverWarehouseBin(@Args('id') id: ID) {
		try {
			return { warehouseBin: await this.warehouseBinService.softRecover(id), userErrors: [] };
		} catch (error) {
			return { warehouseBin: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Reconciles the bins of a location against the movement ledger.
	 *
	 * The corrections land on the levels of the variants the run covers, so the version is optional for
	 * the reason the REST route states it optionally — a stated version is honoured for the level it
	 * names and the compare-and-set covers the rest — and the key carries the same scope the REST route
	 * declares, so a retry over either protocol replays.
	 *
	 * @param input The scope of the run and whether it should repair what it finds.
	 * @returns The payload, carrying the report.
	 */
	@Permissions(WarehousePermissions.WAREHOUSE_BINS_EDIT)
	@Mutation('reconcileWarehouseBins')
	@Versioned({ required: false, target: WAREHOUSE_LEVEL_VERSION_TARGET })
	@Idempotent({ scope: 'warehouse.count', required: false, resourceType: 'warehouse-bin' })
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

	/**
	 * Declares a bin as the home bin of a variant at a location.
	 *
	 * A declaration rather than a move: no movement is written, and reconciliation is what later reports
	 * the declaration once it disagrees with the placement. It writes the level's own address column,
	 * so the version the caller read is required, exactly as the REST route requires it.
	 *
	 * @param id The bin being named.
	 * @param input The variant and the location.
	 * @returns The payload, with the caller-correctable refusals in `userErrors`.
	 */
	@Permissions(WarehousePermissions.WAREHOUSE_BINS_EDIT)
	@Mutation('assignWarehouseBinHome')
	@Versioned({ target: WAREHOUSE_LEVEL_VERSION_TARGET })
	async assignWarehouseBinHome(
		@Args('id') id: ID,
		@Args('input') input: { variantId: ID; warehouseId: ID; levelId?: ID; reason?: string }
	) {
		try {
			return { assigned: await this.warehouseBinService.assignHomeBin(id, input), userErrors: [] };
		} catch (error) {
			return { assigned: false, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Walks received units from the receiving area into a bin.
	 *
	 * The walk lands on one level — the variant at the location — so the version the caller read is
	 * required, exactly as the REST route requires it, and the key makes a retry of the walk replay
	 * rather than arrive twice.
	 *
	 * @param id The bin the units are placed into.
	 * @param input The variant, the quantity and where the units walk from.
	 * @returns The payload, with what the ledger wrote in `putAway`, or the refusal in `userErrors`.
	 */
	@Permissions(WarehousePermissions.WAREHOUSE_BINS_EDIT)
	@Mutation('putAwayWarehouseBin')
	@Versioned({ target: WAREHOUSE_LEVEL_VERSION_TARGET })
	@Idempotent({ scope: 'warehouse.put-away', required: false, resourceType: 'warehouse-bin' })
	async putAwayWarehouseBin(
		@Args('id') id: ID,
		@Args('input')
		input: {
			variantId: ID;
			warehouseId: ID;
			quantity: string;
			fromBinId?: ID;
			stockMovementId?: ID;
			referenceId?: ID;
			reason?: string;
		}
	) {
		try {
			return { putAway: await this.warehouseBinService.putAway(id, input as never), userErrors: [] };
		} catch (error) {
			return { putAway: null, userErrors: [toUserError(error)] };
		}
	}
}
