import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ID } from '@gauzy/contracts';
import { FeatureFlagGuard, Idempotent, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { PickListLine } from '../../pick-list-line/pick-list-line.entity';
import { PackSlip } from '../../pack-slip/pack-slip.entity';
import { PackSlipService } from '../../pack-slip/pack-slip.service';
import { WarehouseFeatures } from '../../warehouse.features';
import { WarehousePermissions } from '../../warehouse.permissions';
import { IPackSlip, PackSlipStatus } from '../../warehouse.types';
import { buildConnection, IPageSelection, resolveWindow } from '../../graphql/pagination';
import { toUserError } from '../../graphql/wire';

/**
 * Packing records.
 *
 * A pack slip exists to ship a fulfilment and hangs off it, so it is authorised with the fulfilment
 * values on both surfaces rather than with a parallel set — a role that may pack is a role that may
 * edit fulfilments, and a second spelling of the same right is how two roles that should be one drift
 * apart.
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
@Resolver('PackSlip')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@FeatureFlag(WarehouseFeatures.WAREHOUSE)
export class PackSlipResolver {
	constructor(private readonly packSlipService: PackSlipService) {}

	/**
	 * Lists pack slips.
	 *
	 * @param filter The slip filter.
	 * @param page The page.
	 * @param withDeleted Whether the retired slips are included.
	 * @returns One page of slips.
	 */
	@Permissions(WarehousePermissions.FULFILLMENTS_VIEW)
	@Query('packSlips')
	async packSlips(
		@Args('filter')
		filter?: {
			warehouseId?: ID;
			pickListId?: ID;
			fulfillmentId?: ID;
			status?: PackSlipStatus;
			number?: string;
			trackingNumber?: string;
		},
		@Args('page') page?: IPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	) {
		const { skip, take } = resolveWindow(page);
		const result = await this.packSlipService.findAll({
			where: {
				...(filter?.warehouseId ? { warehouseId: filter.warehouseId } : {}),
				...(filter?.pickListId ? { pickListId: filter.pickListId } : {}),
				...(filter?.fulfillmentId ? { fulfillmentId: filter.fulfillmentId } : {}),
				...(filter?.status ? { status: filter.status } : {}),
				...(filter?.number ? { number: filter.number } : {}),
				...(filter?.trackingNumber ? { trackingNumber: filter.trackingNumber } : {})
			},
			skip,
			take,
			order: { createdAt: 'DESC' },
			...(withDeleted ? { withDeleted: true } : {})
		} as any);

		return buildConnection(result, skip);
	}

	/**
	 * Reads one slip.
	 *
	 * @param id The slip.
	 * @returns The slip, or null when it is not the caller's.
	 */
	@Permissions(WarehousePermissions.FULFILLMENTS_VIEW)
	@Query('packSlip')
	async packSlip(@Args('id') id: ID): Promise<PackSlip | null> {
		try {
			return await this.packSlipService.findOneDetailed(id);
		} catch (error) {
			return null;
		}
	}

	/**
	 * Creates a slip from a picked list.
	 *
	 * @param warehouseId The location.
	 * @param pickListId The picked list it covers.
	 * @param fulfillmentId The shipment, when the slip is not created from a list.
	 * @param packageCount How many parcels the packing is expected to produce.
	 * @returns The payload.
	 */
	@Permissions(WarehousePermissions.FULFILLMENTS_EDIT)
	@Mutation('createPackSlip')
	async createPackSlip(
		@Args('warehouseId') warehouseId: ID,
		@Args('pickListId') pickListId?: ID,
		@Args('fulfillmentId') fulfillmentId?: ID,
		@Args('packageCount') packageCount?: number
	) {
		try {
			const slip = await this.packSlipService.create({
				warehouseId,
				pickListId,
				fulfillmentId,
				packageCount
			} as any);

			return { packSlip: slip, userErrors: [] };
		} catch (error) {
			return { packSlip: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Records the packing and seals the slip.
	 *
	 * @param id The slip.
	 * @param input What the bench measured.
	 * @returns The payload.
	 */
	@Permissions(WarehousePermissions.FULFILLMENTS_EDIT)
	@Mutation('packPackSlip')
	@Idempotent({ scope: 'warehouse.pack', required: false, resourceType: 'pack-slip' })
	async packPackSlip(
		@Args('id') id: ID,
		@Args('input')
		input: {
			packageCount: number;
			totalWeight?: string;
			totalVolume?: string;
			carrierKey?: string;
			trackingNumber?: string;
			labelUrl?: string;
			note?: string;
		}
	) {
		try {
			return { packSlip: await this.packSlipService.pack(id, input), userErrors: [] };
		} catch (error) {
			return { packSlip: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Voids a slip that was never packed.
	 *
	 * @param id The slip.
	 * @param reason Why it was voided.
	 * @returns The payload.
	 */
	@Permissions(WarehousePermissions.FULFILLMENTS_EDIT)
	@Mutation('voidPackSlip')
	async voidPackSlip(@Args('id') id: ID, @Args('reason') reason?: string) {
		try {
			return { packSlip: await this.packSlipService.cancel(id, reason), userErrors: [] };
		} catch (error) {
			return { packSlip: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Resolves the lines a slip covers.
	 *
	 * @param slip The slip being read.
	 * @returns The lines.
	 */
	@Permissions(WarehousePermissions.FULFILLMENTS_VIEW)
	@ResolveField('lines')
	async lines(@Parent() slip: IPackSlip): Promise<PickListLine[]> {
		return (slip as PackSlip).lines ?? [];
	}
}
