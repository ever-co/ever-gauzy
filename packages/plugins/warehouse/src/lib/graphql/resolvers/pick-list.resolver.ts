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
import { deleteOutcome, toUserError } from '../../graphql/wire';

/** The patch `PUT /pick-lists/:id` accepts, as the route's own body declares it. */
interface IUpdatePickListInput {
	waveId?: ID;
	warehouseId?: ID;
	zoneId?: ID;
	fulfillmentId?: ID;
	orderId?: ID;
	number?: string;
	status?: PickListStatus;
	assignedToUserId?: ID;
	priority?: number;
	lineCount?: number;
	pickedCount?: number;
	shortCount?: number;
	startedAt?: Date;
	completedAt?: Date;
	note?: string;
	version?: number;
	metadata?: Record<string, unknown>;
}

/**
 * The work, per picker: the lists and their lifecycle.
 *
 * The resolvers call the same services the REST surface calls, so a list generated over GraphQL and one
 * generated over REST obey the same derivation and the same idempotence rule. The outcomes recorded
 * against a line belong to the line's own resolver, because they are guarded differently.
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
	 * Edits a pick list: the assignee, the priority and the picker-facing note.
	 *
	 * The route it mirrors is `PUT /pick-lists/:id`, and both of its calls are reproduced rather than
	 * collapsed: the write, and the read back through `findOneDetailed`. The route answers the list as
	 * the edit left it, and the detail read is what carries the lines and their bins — a field that
	 * answered the update's own result would describe the same edit with less.
	 *
	 * The route declares no version precondition, so this field declares none either: a version
	 * expectation invented here would refuse over GraphQL an edit the REST route accepts.
	 *
	 * @param id The list.
	 * @param input The fields to change.
	 * @returns The payload, with the list as the edit left it.
	 */
	@Permissions(WarehousePermissions.PICK_LISTS_EDIT)
	@Mutation('updatePickList')
	async updatePickList(@Args('id') id: ID, @Args('input') input: IUpdatePickListInput) {
		try {
			await this.pickListService.update(id, input as any);

			return { pickList: await this.pickListService.findOneDetailed(id), userErrors: [] };
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
	 * Deletes a pick list outright, destroying the lines and the recorded outcomes it holds.
	 *
	 * The route it mirrors is `DELETE /pick-lists/:id`, inherited from `CrudController` and overridden
	 * by the controller only to state the permission the base left unstated. This is the **destructive**
	 * removal: the row and the work recorded against it are gone, which is why the answer carries no row
	 * to read back. `softDeletePickList` beside it is the recoverable pair — it keeps the lines and
	 * `recoverPickList` brings the list back — and cancelling is a third, different act: it states
	 * something about the work and is refused for a list anything has been picked from.
	 *
	 * It is delivered because the same `CrudController` route is already mirrored for the two layout
	 * resources of this plugin (`deleteWarehouseBin`, `deleteWarehouseZone`): the aggregate's own
	 * destructive route cannot be the one left standing open to REST callers alone.
	 *
	 * A removal that matched no row — an identifier of another tenant, a stale one, one already gone — is
	 * not a removal: the scoped statement reports `affected: 0` without raising, and the payload answers it
	 * with a `NOT_FOUND` outcome on `id` (`deleteOutcome`) rather than with the empty `userErrors` of a
	 * success.
	 *
	 * @param id The list to delete.
	 * @returns The payload, empty of the row that was removed, or the refusal or the `NOT_FOUND` in
	 * `userErrors`.
	 */
	@Permissions(WarehousePermissions.PICK_LISTS_EDIT)
	@Mutation('deletePickList')
	async deletePickList(@Args('id') id: ID) {
		try {
			const result = await this.pickListService.delete(id);

			return { pickList: null, userErrors: deleteOutcome(result, id) };
		} catch (error) {
			return { pickList: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Retires a pick list recoverably, keeping the lines it was walked with.
	 *
	 * The route it mirrors is `DELETE /pick-lists/:id/soft`, inherited from `CrudController` and overridden
	 * by the controller only to state the permission the base left unstated. Cancelling is a statement
	 * about the work and refuses a list anything has been picked from, so it is not a substitute for this:
	 * without this field a list a caller retired over GraphQL had no field to bring it back, while a REST
	 * caller could retire and restore it.
	 *
	 * The permission is the controller's own for the route — `PICK_LISTS_EDIT` — and not the class-level
	 * view grant, because retiring a list takes the work it covers off the floor.
	 *
	 * @param id The list to retire.
	 * @returns The payload, with the retired list or the reason it was refused.
	 */
	@Permissions(WarehousePermissions.PICK_LISTS_EDIT)
	@Mutation('softDeletePickList')
	async softDeletePickList(@Args('id') id: ID) {
		try {
			return { pickList: await this.pickListService.softRemove(id), userErrors: [] };
		} catch (error) {
			return { pickList: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Restores a pick list that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /pick-lists/:id/recover`, inherited from `CrudController` and overridden
	 * by the controller only to state the permission the base left unstated. A restored list is walkable
	 * again and its lines are read through it, which is why the route states the editing grant rather than
	 * the reading one.
	 *
	 * @param id The list to restore.
	 * @returns The payload, with the restored list or the reason it was refused.
	 */
	@Permissions(WarehousePermissions.PICK_LISTS_EDIT)
	@Mutation('recoverPickList')
	async recoverPickList(@Args('id') id: ID) {
		try {
			return { pickList: await this.pickListService.softRecover(id), userErrors: [] };
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
