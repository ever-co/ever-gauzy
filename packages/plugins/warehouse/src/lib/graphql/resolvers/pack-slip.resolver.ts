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
import { deleteOutcome, toUserError } from '../../graphql/wire';

/** The patch `PUT /pack-slips/:id` accepts, as the route's own body declares it. */
interface IUpdatePackSlipInput {
	warehouseId?: ID;
	pickListId?: ID;
	orderId?: ID;
	fulfillmentId?: ID;
	number?: string;
	status?: PackSlipStatus;
	carrierKey?: string;
	packageCount?: number;
	totalWeight?: string;
	totalVolume?: string;
	trackingNumber?: string;
	labelUrl?: string;
	packedAt?: Date;
	packedByUserId?: ID;
	note?: string;
	version?: number;
	metadata?: Record<string, unknown>;
}

/**
 * Packing records.
 *
 * A pack slip exists to ship a fulfilment and hangs off it, so it is authorised with the fulfilment
 * values on both surfaces rather than with a parallel set — a role that may pack is a role that may
 * edit fulfilments, and a second spelling of the same right is how two roles that should be one drift
 * apart.
 *
 * **Both gates are checked: the catalogue's and the domain's.** The two `@FeatureFlag` statements on the
 * class accumulate rather than the upper one replacing the lower, and `FeatureFlagGuard` requires every
 * code a handler states or, where the handler states none — as no field below does — every code its
 * class states. Each field therefore runs only for a tenant that has both `FEATURE_GRAPHQL`, the commerce
 * catalogue's entry for "the GraphQL endpoint and its resolvers, under the same guards and permissions
 * as REST", and `WarehouseFeatures.WAREHOUSE`, the capability the routes serving the same resources
 * carry. A tenant that switched either off is answered the refusal a disabled capability's routes
 * answer with a 404 — which is what stops a write the REST route refuses with the warehouse switched off
 * from still landing over this surface.
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
	 * Edits an open pack slip: the parcel count, the weight and volume of record, the carrier and the
	 * label.
	 *
	 * The route it mirrors is `PUT /pack-slips/:id`, and both of its calls are reproduced rather than
	 * collapsed: the write, and the read back through `findOneDetailed`, because the route answers the
	 * slip with the lines it covers and a field that answered the update's own result would answer less.
	 *
	 * A `PACKED` slip is immutable and the service refuses the edit — the same refusal answers the route,
	 * which is why neither surface states the precondition in its own signature. The route declares no
	 * version precondition either, so this field declares none.
	 *
	 * @param id The slip.
	 * @param input The fields to change.
	 * @returns The payload, with the slip as the edit left it.
	 */
	@Permissions(WarehousePermissions.FULFILLMENTS_EDIT)
	@Mutation('updatePackSlip')
	async updatePackSlip(@Args('id') id: ID, @Args('input') input: IUpdatePackSlipInput) {
		try {
			await this.packSlipService.update(id, input as any);

			return { packSlip: await this.packSlipService.findOneDetailed(id), userErrors: [] };
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
	 * Deletes a pack slip outright, destroying the packing record a carrier claim reads.
	 *
	 * The route it mirrors is `DELETE /pack-slips/:id`, inherited from `CrudController` and overridden by
	 * the controller only to state the permission the base left unstated. This is the **destructive**
	 * removal: the weight of record, the tracking number and the parcel composition are gone rather than
	 * retired, which is why the answer carries no row to read back. `softDeletePackSlip` beside it is the
	 * recoverable pair — it keeps the packing record and the lines it covers and `recoverPackSlip` brings
	 * it back — and voiding is a third, different act: it is a statement about the parcel that leaves the
	 * row in place with a status.
	 *
	 * It is delivered because the same `CrudController` route is already mirrored for the two layout
	 * resources of this plugin (`deleteWarehouseBin`, `deleteWarehouseZone`): a REST caller cannot be the
	 * only one able to remove a slip.
	 *
	 * A removal that matched no row — an identifier of another tenant, a stale one, one already gone — is
	 * not a removal: the scoped statement reports `affected: 0` without raising, and the payload answers it
	 * with a `NOT_FOUND` outcome on `id` (`deleteOutcome`) rather than with the empty `userErrors` of a
	 * success.
	 *
	 * @param id The slip to delete.
	 * @returns The payload, empty of the row that was removed, or the refusal or the `NOT_FOUND` in
	 * `userErrors`.
	 */
	@Permissions(WarehousePermissions.FULFILLMENTS_EDIT)
	@Mutation('deletePackSlip')
	async deletePackSlip(@Args('id') id: ID) {
		try {
			const result = await this.packSlipService.delete(id);

			return { packSlip: null, userErrors: deleteOutcome(result, id) };
		} catch (error) {
			return { packSlip: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Retires a slip recoverably, keeping the packing record and the lines it covers.
	 *
	 * The route it mirrors is `DELETE /pack-slips/:id/soft`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. Voiding a slip is
	 * a different act — it is a statement about the parcel, and it leaves the row in place with a status —
	 * so without this field a slip a caller retired over GraphQL had no field to bring it back, while a
	 * REST caller could retire and restore it.
	 *
	 * The permission is the controller's own for the route — `FULFILLMENTS_EDIT` — and not the class-level
	 * view grant, because the weight of record and the tracking number live on this row.
	 *
	 * @param id The slip to retire.
	 * @returns The payload, with the retired slip or the reason it was refused.
	 */
	@Permissions(WarehousePermissions.FULFILLMENTS_EDIT)
	@Mutation('softDeletePackSlip')
	async softDeletePackSlip(@Args('id') id: ID) {
		try {
			return { packSlip: await this.packSlipService.softRemove(id), userErrors: [] };
		} catch (error) {
			return { packSlip: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Restores a slip that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /pack-slips/:id/recover`, inherited from `CrudController` and overridden
	 * by the controller only to state the permission the base left unstated. A restored slip is what a
	 * manifest reads its packed weight from again, which is why the route states the editing grant rather
	 * than the reading one.
	 *
	 * @param id The slip to restore.
	 * @returns The payload, with the restored slip or the reason it was refused.
	 */
	@Permissions(WarehousePermissions.FULFILLMENTS_EDIT)
	@Mutation('recoverPackSlip')
	async recoverPackSlip(@Args('id') id: ID) {
		try {
			return { packSlip: await this.packSlipService.softRecover(id), userErrors: [] };
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
