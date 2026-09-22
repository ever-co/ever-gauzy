import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ID } from '@gauzy/contracts';
import { FeatureFlagGuard, Idempotent, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { CarrierManifestService, CarrierManifestWithMembers } from '../../carrier-manifest/carrier-manifest.service';
import { CarrierManifest } from '../../carrier-manifest/carrier-manifest.entity';
import { WarehouseFeatures } from '../../warehouse.features';
import { WarehousePermissions } from '../../warehouse.permissions';
import { CarrierManifestStatus, ICarrierManifest, IWarehouseShippedFulfillment } from '../../warehouse.types';
import { buildConnection, IPageSelection, resolveWindow } from '../../graphql/pagination';
import { toUserError } from '../../graphql/wire';

/**
 * The documents handed to a carrier.
 *
 * Membership is never posted on either surface: a draft resolves it from what actually shipped inside
 * the window and has not been claimed, and closing freezes it. A caller that could name the members
 * could put one parcel on two manifests, which is the invariant the table exists to keep.
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
@Resolver('CarrierManifest')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@FeatureFlag(WarehouseFeatures.WAREHOUSE)
export class CarrierManifestResolver {
	constructor(private readonly carrierManifestService: CarrierManifestService) {}

	/**
	 * Lists manifests.
	 *
	 * @param filter The manifest filter.
	 * @param page The page.
	 * @param withDeleted Whether the retired manifests are included.
	 * @returns One page of manifests.
	 */
	@Permissions(WarehousePermissions.FULFILLMENTS_VIEW)
	@Query('carrierManifests')
	async carrierManifests(
		@Args('filter')
		filter?: {
			warehouseId?: ID;
			carrier?: string;
			status?: CarrierManifestStatus;
			number?: string;
			manifestDate?: Date;
		},
		@Args('page') page?: IPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	) {
		const { skip, take } = resolveWindow(page);
		const result = await this.carrierManifestService.findAll({
			where: {
				...(filter?.warehouseId ? { warehouseId: filter.warehouseId } : {}),
				...(filter?.carrier ? { carrier: filter.carrier } : {}),
				...(filter?.status ? { status: filter.status } : {}),
				...(filter?.number ? { number: filter.number } : {}),
				...(filter?.manifestDate ? { manifestDate: filter.manifestDate } : {})
			},
			skip,
			take,
			order: { manifestDate: 'DESC', createdAt: 'DESC' },
			...(withDeleted ? { withDeleted: true } : {})
		} as any);

		return buildConnection(result, skip);
	}

	/**
	 * Reads one manifest.
	 *
	 * @param id The manifest.
	 * @returns The manifest, or null when it is not the caller's.
	 */
	@Permissions(WarehousePermissions.FULFILLMENTS_VIEW)
	@Query('carrierManifest')
	async carrierManifest(@Args('id') id: ID): Promise<CarrierManifestWithMembers | null> {
		try {
			return await this.carrierManifestService.findOneDetailed(id);
		} catch (error) {
			return null;
		}
	}

	/**
	 * Builds a draft manifest for a carrier.
	 *
	 * @param input The manifest.
	 * @returns The payload.
	 */
	@Permissions(WarehousePermissions.FULFILLMENTS_EDIT)
	@Mutation('createCarrierManifest')
	async createCarrierManifest(
		@Args('input')
		input: {
			warehouseId: ID;
			carrier: string;
			service?: string;
			manifestDate?: Date;
			windowFrom?: Date;
			windowTo?: Date;
			note?: string;
		}
	) {
		try {
			return { carrierManifest: await this.carrierManifestService.create(input as any), userErrors: [] };
		} catch (error) {
			return { carrierManifest: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Submits a draft: membership is frozen on every member shipment.
	 *
	 * @param id The manifest.
	 * @returns The payload.
	 */
	@Permissions(WarehousePermissions.FULFILLMENTS_EDIT)
	@Mutation('submitCarrierManifest')
	async submitCarrierManifest(@Args('id') id: ID) {
		try {
			return { carrierManifest: await this.carrierManifestService.close(id), userErrors: [] };
		} catch (error) {
			return { carrierManifest: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Records the carrier taking custody at the dock.
	 *
	 * @param id The manifest.
	 * @param input What the dock recorded, including any scan that does not match the manifest.
	 * @returns The payload.
	 */
	@Permissions(WarehousePermissions.FULFILLMENTS_EDIT)
	@Mutation('handOverCarrierManifest')
	@Idempotent({ scope: 'warehouse.handover', required: false, resourceType: 'carrier-manifest' })
	async handOverCarrierManifest(
		@Args('id') id: ID,
		@Args('input') input?: { scanCount?: number; scannedTrackingNumbers?: string[]; note?: string }
	) {
		try {
			return { carrierManifest: await this.carrierManifestService.handOver(id, input ?? {}), userErrors: [] };
		} catch (error) {
			return { carrierManifest: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Cancels a manifest the carrier has not taken.
	 *
	 * @param id The manifest.
	 * @param reason Why it was withdrawn.
	 * @returns The payload.
	 */
	@Permissions(WarehousePermissions.FULFILLMENTS_EDIT)
	@Mutation('cancelCarrierManifest')
	async cancelCarrierManifest(@Args('id') id: ID, @Args('reason') reason?: string) {
		try {
			return { carrierManifest: await this.carrierManifestService.cancel(id, reason), userErrors: [] };
		} catch (error) {
			return { carrierManifest: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Resolves the shipments a manifest covers.
	 *
	 * @param manifest The manifest being read.
	 * @returns The member shipments.
	 */
	@Permissions(WarehousePermissions.FULFILLMENTS_VIEW)
	@ResolveField('members')
	async members(@Parent() manifest: ICarrierManifest): Promise<IWarehouseShippedFulfillment[]> {
		if (Array.isArray((manifest as unknown as CarrierManifestWithMembers).members)) {
			return (manifest as unknown as CarrierManifestWithMembers).members;
		}

		const detailed = await this.carrierManifestService.findOneDetailed((manifest as CarrierManifest).id);

		return detailed.members;
	}
}
