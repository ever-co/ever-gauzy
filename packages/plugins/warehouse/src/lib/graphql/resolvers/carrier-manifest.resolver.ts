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

/** The patch `PUT /carrier-manifests/:id` accepts, as the route's own body declares it. */
interface IUpdateCarrierManifestInput {
	warehouseId?: ID;
	carrier?: string;
	service?: string;
	number?: string;
	status?: CarrierManifestStatus;
	manifestDate?: Date;
	windowFrom?: Date;
	windowTo?: Date;
	shipmentCount?: number;
	packageCount?: number;
	totalWeight?: string;
	closedAt?: Date;
	handedOverAt?: Date;
	canceledAt?: Date;
	documentUrl?: string;
	documentData?: Record<string, unknown>;
	note?: string;
	version?: number;
	metadata?: Record<string, unknown>;
}

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
	 * Corrects a draft manifest: the dispatch day, the collection window and the note.
	 *
	 * The route it mirrors is `PUT /carrier-manifests/:id`, and both of its calls are reproduced rather
	 * than collapsed: the write, then the read back through `findOneScoped` — the route answers the
	 * manifest itself, and the detail read that carries the member shipments belongs to the query field,
	 * not to this one.
	 *
	 * Membership is not editable here at any status, which is the invariant the whole table exists to
	 * keep: a draft resolves its members from what actually shipped inside the window and a close freezes
	 * them, so a caller that could name them could put one parcel on two manifests. A `CLOSED` or
	 * `HANDED_OVER` manifest is refused by the service, and the route declares no version precondition,
	 * so neither does this field.
	 *
	 * @param id The manifest.
	 * @param input The fields to change.
	 * @returns The payload, with the manifest as the correction left it.
	 */
	@Permissions(WarehousePermissions.FULFILLMENTS_EDIT)
	@Mutation('updateCarrierManifest')
	async updateCarrierManifest(@Args('id') id: ID, @Args('input') input: IUpdateCarrierManifestInput) {
		try {
			await this.carrierManifestService.update(id, input as any);

			return { carrierManifest: await this.carrierManifestService.findOneScoped(id), userErrors: [] };
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
	 * Deletes a manifest outright, destroying the hand-over record the carrier accepted.
	 *
	 * The route it mirrors is `DELETE /carrier-manifests/:id`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. This is the
	 * **destructive** removal: the row a carrier's acceptance is recorded on is gone rather than retired,
	 * which is why the answer carries no row to read back. `softDeleteCarrierManifest` beside it is the
	 * recoverable pair — it keeps the hand-over it records and `recoverCarrierManifest` brings it back —
	 * and cancelling is a third, different act: it is what the dock decided before hand-over and it
	 * returns the members to the pool.
	 *
	 * It is delivered because the same `CrudController` route is already mirrored for the two layout
	 * resources of this plugin (`deleteWarehouseBin`, `deleteWarehouseZone`): the document is not the one
	 * resource whose destructive route stays REST-only.
	 *
	 * @param id The manifest to delete.
	 * @returns The payload, empty of the row that was removed, or the refusal in `userErrors`.
	 */
	@Permissions(WarehousePermissions.FULFILLMENTS_EDIT)
	@Mutation('deleteCarrierManifest')
	async deleteCarrierManifest(@Args('id') id: ID) {
		try {
			await this.carrierManifestService.delete(id);

			return { carrierManifest: null, userErrors: [] };
		} catch (error) {
			return { carrierManifest: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Retires a manifest recoverably, keeping the hand-over it records.
	 *
	 * The route it mirrors is `DELETE /carrier-manifests/:id/soft`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. Cancelling is a
	 * different act — it is what the dock decided before hand-over — so without this field a manifest a
	 * caller retired over GraphQL had no field to bring it back, while a REST caller could retire and
	 * restore it.
	 *
	 * The permission is the controller's own for the route — `FULFILLMENTS_EDIT` — and not the class-level
	 * view grant, because the document a carrier accepted is what this row is.
	 *
	 * @param id The manifest to retire.
	 * @returns The payload, with the retired manifest or the reason it was refused.
	 */
	@Permissions(WarehousePermissions.FULFILLMENTS_EDIT)
	@Mutation('softDeleteCarrierManifest')
	async softDeleteCarrierManifest(@Args('id') id: ID) {
		try {
			return { carrierManifest: await this.carrierManifestService.softRemove(id), userErrors: [] };
		} catch (error) {
			return { carrierManifest: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Restores a manifest that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /carrier-manifests/:id/recover`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. A restored manifest
	 * is what the shipments it claimed are read back through, which is why the route states the editing
	 * grant rather than the reading one.
	 *
	 * @param id The manifest to restore.
	 * @returns The payload, with the restored manifest or the reason it was refused.
	 */
	@Permissions(WarehousePermissions.FULFILLMENTS_EDIT)
	@Mutation('recoverCarrierManifest')
	async recoverCarrierManifest(@Args('id') id: ID) {
		try {
			return { carrierManifest: await this.carrierManifestService.softRecover(id), userErrors: [] };
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
