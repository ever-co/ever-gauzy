import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ID } from '@gauzy/contracts';
import { FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { PickList } from '../../pick-list/pick-list.entity';
import { PickListService } from '../../pick-list/pick-list.service';
import { PickListLine } from '../../pick-list-line/pick-list-line.entity';
import { PickListLineService } from '../../pick-list-line/pick-list-line.service';
import { WarehouseFeatures } from '../../warehouse.features';
import { WarehousePermissions } from '../../warehouse.permissions';
import { IPickList, PickListStatus } from '../../warehouse.types';
import { buildConnection, IPageSelection, resolveWindow } from '../../graphql/pagination';
import { toUserError } from '../../graphql/wire';

/**
 * The work, per picker: the lists and their lifecycle.
 *
 * The resolvers call the same services the REST surface calls, so a list generated over GraphQL and one
 * generated over REST obey the same derivation and the same idempotence rule. The outcomes recorded
 * against a line belong to the line's own resolver, because they are guarded differently.
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
@Resolver('PickList')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@FeatureFlag(WarehouseFeatures.WAREHOUSE)
export class PickListResolver {
	constructor(
		private readonly pickListService: PickListService,
		private readonly pickListLineService: PickListLineService
	) {}

	/**
	 * Lists pick lists.
	 *
	 * @param filter The list filter.
	 * @param page The page.
	 * @param withDeleted Whether the retired lists are included.
	 * @returns One page of lists.
	 */
	@Permissions(WarehousePermissions.PICK_LISTS_VIEW)
	@Query('pickLists')
	async pickLists(
		@Args('filter')
		filter?: {
			warehouseId?: ID;
			waveId?: ID;
			zoneId?: ID;
			fulfillmentId?: ID;
			status?: PickListStatus;
			assignedToUserId?: ID;
			number?: string;
		},
		@Args('page') page?: IPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	) {
		const { skip, take } = resolveWindow(page);
		const result = await this.pickListService.findAll({
			where: {
				...(filter?.warehouseId ? { warehouseId: filter.warehouseId } : {}),
				...(filter?.waveId ? { waveId: filter.waveId } : {}),
				...(filter?.zoneId ? { zoneId: filter.zoneId } : {}),
				...(filter?.fulfillmentId ? { fulfillmentId: filter.fulfillmentId } : {}),
				...(filter?.status ? { status: filter.status } : {}),
				...(filter?.assignedToUserId ? { assignedToUserId: filter.assignedToUserId } : {}),
				...(filter?.number ? { number: filter.number } : {})
			},
			skip,
			take,
			order: { priority: 'DESC', createdAt: 'ASC' },
			...(withDeleted ? { withDeleted: true } : {})
		} as any);

		return buildConnection(result, skip);
	}

	/**
	 * Reads one list.
	 *
	 * @param id The list.
	 * @returns The list, or null when it is not the caller's.
	 */
	@Permissions(WarehousePermissions.PICK_LISTS_VIEW)
	@Query('pickList')
	async pickList(@Args('id') id: ID): Promise<PickList | null> {
		try {
			return await this.pickListService.findOneDetailed(id);
		} catch (error) {
			return null;
		}
	}

	/**
	 * Creates a list from shipments.
	 *
	 * @param input The list.
	 * @returns The payload.
	 */
	@Permissions(WarehousePermissions.PICK_LISTS_EDIT)
	@Mutation('createPickList')
	async createPickList(
		@Args('input') input: { warehouseId: ID; waveId?: ID; zoneId?: ID; priority?: number; fulfillmentIds?: ID[] }
	) {
		try {
			return { pickList: await this.pickListService.create(input as any), userErrors: [] };
		} catch (error) {
			return { pickList: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Assigns a list to a picker.
	 *
	 * @param id The list.
	 * @param assignedToUserId The picker.
	 * @returns The payload.
	 */
	@Permissions(WarehousePermissions.PICK_LISTS_EDIT)
	@Mutation('assignPickList')
	async assignPickList(@Args('id') id: ID, @Args('assignedToUserId') assignedToUserId: ID) {
		try {
			return { pickList: await this.pickListService.assign(id, assignedToUserId), userErrors: [] };
		} catch (error) {
			return { pickList: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Marks a list as being walked.
	 *
	 * @param id The list.
	 * @returns The payload.
	 */
	@Permissions(WarehousePermissions.PICK_LISTS_EDIT)
	@Mutation('startPickList')
	async startPickList(@Args('id') id: ID) {
		try {
			return { pickList: await this.pickListService.start(id), userErrors: [] };
		} catch (error) {
			return { pickList: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Completes a list whose lines all reached an outcome.
	 *
	 * @param id The list.
	 * @returns The payload.
	 */
	@Permissions(WarehousePermissions.PICK_LISTS_EDIT)
	@Mutation('completePickList')
	async completePickList(@Args('id') id: ID) {
		try {
			return { pickList: await this.pickListService.complete(id), userErrors: [] };
		} catch (error) {
			return { pickList: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Cancels a list nothing has been picked from.
	 *
	 * @param id The list.
	 * @param reason Why it was cancelled.
	 * @returns The payload.
	 */
	@Permissions(WarehousePermissions.PICK_LISTS_EDIT)
	@Mutation('cancelPickList')
	async cancelPickList(@Args('id') id: ID, @Args('reason') reason?: string) {
		try {
			return { pickList: await this.pickListService.cancel(id, reason), userErrors: [] };
		} catch (error) {
			return { pickList: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Resolves the lines of a list.
	 *
	 * @param list The list being read.
	 * @returns The lines.
	 */
	@Permissions(WarehousePermissions.PICK_LISTS_VIEW)
	@ResolveField('lines')
	async lines(@Parent() list: IPickList): Promise<PickListLine[]> {
		if (Array.isArray((list as PickList).lines)) {
			return (list as PickList).lines;
		}

		return await this.pickListLineService.findForList(list.id);
	}
}
