import { BadRequestException, UseGuards } from '@nestjs/common';
import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
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
import { PickListLine } from '../../pick-list-line/pick-list-line.entity';
import { PickListLineService } from '../../pick-list-line/pick-list-line.service';
import { WarehouseBin } from '../../warehouse-bin/warehouse-bin.entity';
import { WarehouseBinService } from '../../warehouse-bin/warehouse-bin.service';
import { WarehouseFeatures } from '../../warehouse.features';
import { WarehousePermissions } from '../../warehouse.permissions';
import { IPickListLine, WAREHOUSE_LEVEL_VERSION_TARGET } from '../../warehouse.types';
import { toUserError } from '../../graphql/wire';

/**
 * The lines of a pick list: what was asked for, from which bin, and what actually happened.
 *
 * The three outcomes live here because each of them is a statement about a line, and each of them is
 * guarded by `PICK_LISTS_PICK` rather than by the permission that releases the work — a picker holds
 * one without holding the other, and the two surfaces keep that apart in the same way.
 *
 * The inherited lifecycle pair lives here as well — `softDeletePickListLine` and `recoverPickListLine` —
 * and it is **not** guarded by `PICK_LISTS_PICK`: withdrawing a line is a change to the work rather than
 * an outcome recorded against it, so both fields state `PICK_LISTS_EDIT`, which is what the two routes
 * they mirror state.
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
@Resolver('PickListLine')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@FeatureFlag(WarehouseFeatures.WAREHOUSE)
export class PickListLineResolver {
	constructor(
		private readonly pickListLineService: PickListLineService,
		private readonly warehouseBinService: WarehouseBinService
	) {}

	/**
	 * Reads the lines of a list.
	 *
	 * The service answers every line of the list in the order the pick path visits them and takes no
	 * window, so the page is cut here. Answering the whole list to a caller that asked for one page is the
	 * failure this avoids: the walk would be over before the client knew there was one to continue.
	 *
	 * @param pickListId The list.
	 * @param page The page.
	 * @param withDeleted Whether the retired lines are included.
	 * @returns One page of lines, in the order the pick path visits them.
	 * @throws for a page the query protocol refuses — both styles at once, both directions at once, a
	 * cursor this platform did not mint — which is deliberately not caught here.
	 */
	@Permissions(WarehousePermissions.PICK_LISTS_VIEW)
	@Query('pickListLines')
	async pickListLines(
		@Args('pickListId') pickListId: ID,
		@Args('page', { type: () => Object, nullable: true }) page?: IConnectionPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	): Promise<GraphqlConnection<PickListLine>> {
		const { skip, take } = resolveConnectionWindow(page);
		const rows = await this.pickListLineService.findForList(pickListId, withDeleted ? { withDeleted: true } : {});

		return connectionFromOffsetPage(paginateRows(rows, take, skip), skip);
	}

	/**
	 * Reads one line.
	 *
	 * @param id The line.
	 * @returns The line, or null when it is not the caller's.
	 */
	@Permissions(WarehousePermissions.PICK_LISTS_VIEW)
	@Query('pickListLine')
	async pickListLine(@Args('id') id: ID): Promise<PickListLine | null> {
		try {
			return await this.pickListLineService.findOneScoped(id);
		} catch (error) {
			return null;
		}
	}

	/**
	 * Records what was taken from the bin.
	 *
	 * @param pickListId The list named in the request.
	 * @param lineId The line.
	 * @param pickedQuantity What was collected.
	 * @param binId The bin it was taken from, when it changed.
	 * @param lotNumber The lot scanned.
	 * @param serialNumbers The serials scanned.
	 * @param note An operator note.
	 * @returns The payload.
	 */
	@Permissions(WarehousePermissions.PICK_LISTS_PICK)
	@Mutation('pickPickListLine')
	@Versioned({ required: false, target: WAREHOUSE_LEVEL_VERSION_TARGET })
	@Idempotent({ scope: 'warehouse.pick', required: false, resourceType: 'pick-list-line' })
	async pickPickListLine(
		@Args('pickListId') pickListId: ID,
		@Args('lineId') lineId: ID,
		@Args('pickedQuantity') pickedQuantity: string,
		@Args('binId') binId?: ID,
		@Args('lotNumber') lotNumber?: string,
		@Args('serialNumbers') serialNumbers?: string[],
		@Args('note') note?: string
	) {
		try {
			await this.assertLineBelongsTo(pickListId, lineId);

			const line = await this.pickListLineService.recordPick(lineId, {
				pickedQuantity,
				binId,
				lotNumber,
				serialNumbers,
				note
			});

			return { pickListLine: line, userErrors: [] };
		} catch (error) {
			return { pickListLine: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Records a substitute: a different unit was taken instead of the one the list named.
	 *
	 * @param pickListId The list named in the request.
	 * @param lineId The line.
	 * @param substituteVariantId The variant actually taken.
	 * @param substituteQuantity How much of it was taken.
	 * @param substitutionReason Why it is acceptable.
	 * @param binId The bin it was taken from.
	 * @param note An operator note.
	 * @returns The payload.
	 */
	@Permissions(WarehousePermissions.PICK_LISTS_PICK)
	@Mutation('substitutePickListLine')
	@Versioned({ required: false, target: WAREHOUSE_LEVEL_VERSION_TARGET })
	@Idempotent({ scope: 'warehouse.substitute', required: false, resourceType: 'pick-list-line' })
	async substitutePickListLine(
		@Args('pickListId') pickListId: ID,
		@Args('lineId') lineId: ID,
		@Args('substituteVariantId') substituteVariantId: ID,
		@Args('substituteQuantity') substituteQuantity: string,
		@Args('substitutionReason') substitutionReason?: string,
		@Args('binId') binId?: ID,
		@Args('note') note?: string
	) {
		try {
			await this.assertLineBelongsTo(pickListId, lineId);

			const line = await this.pickListLineService.recordSubstitution(lineId, {
				substituteVariantId,
				substituteQuantity,
				substitutionReason,
				binId,
				note
			});

			return { pickListLine: line, userErrors: [] };
		} catch (error) {
			return { pickListLine: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Records a line the picker deliberately did not collect.
	 *
	 * @param pickListId The list named in the request.
	 * @param lineId The line.
	 * @param note Why it was skipped.
	 * @returns The payload.
	 */
	@Permissions(WarehousePermissions.PICK_LISTS_PICK)
	@Mutation('skipPickListLine')
	async skipPickListLine(
		@Args('pickListId') pickListId: ID,
		@Args('lineId') lineId: ID,
		@Args('note') note?: string
	) {
		try {
			await this.assertLineBelongsTo(pickListId, lineId);

			return { pickListLine: await this.pickListLineService.recordSkip(lineId, note), userErrors: [] };
		} catch (error) {
			return { pickListLine: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Retires a line recoverably, keeping what the picker recorded against it.
	 *
	 * The route it mirrors is `DELETE /pick-list-lines/:id/soft`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. This is the one
	 * root field of the pair that is not reached through a list: the route takes the line's own identifier
	 * and nothing else, so the field takes the same, and the guard against naming a line of another list
	 * belongs to the fields that name both.
	 *
	 * The permission is the controller's own for the route — `PICK_LISTS_EDIT` — and not the class-level
	 * view grant, and deliberately not `PICK_LISTS_PICK` either: withdrawing a line is a change to the
	 * work, not an outcome recorded against it.
	 *
	 * @param id The line to retire.
	 * @returns The payload, with the retired line or the reason it was refused.
	 */
	@Permissions(WarehousePermissions.PICK_LISTS_EDIT)
	@Mutation('softDeletePickListLine')
	async softDeletePickListLine(@Args('id') id: ID) {
		try {
			return { pickListLine: await this.pickListLineService.softRemove(id), userErrors: [] };
		} catch (error) {
			return { pickListLine: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Restores a line that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /pick-list-lines/:id/recover`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. A restored line
	 * counts again in the list's own counters, which is why the route states the editing grant rather than
	 * the reading one.
	 *
	 * @param id The line to restore.
	 * @returns The payload, with the restored line or the reason it was refused.
	 */
	@Permissions(WarehousePermissions.PICK_LISTS_EDIT)
	@Mutation('recoverPickListLine')
	async recoverPickListLine(@Args('id') id: ID) {
		try {
			return { pickListLine: await this.pickListLineService.softRecover(id), userErrors: [] };
		} catch (error) {
			return { pickListLine: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Resolves the bin a line names.
	 *
	 * @param line The line being read.
	 * @returns The bin, or null when the line is unbinned or the bin is gone.
	 */
	@Permissions(WarehousePermissions.PICK_LISTS_VIEW)
	@ResolveField('bin')
	async bin(@Parent() line: IPickListLine): Promise<WarehouseBin | null> {
		if ((line as PickListLine).bin) {
			return (line as PickListLine).bin;
		}

		if (!line.binId) {
			return null;
		}

		try {
			return await this.warehouseBinService.findOneScoped(line.binId);
		} catch (error) {
			return null;
		}
	}

	/**
	 * Asserts that a line is one of a list's own, so a request that names both cannot cross them.
	 *
	 * @param pickListId The list named in the request.
	 * @param lineId The line named in the request.
	 * @throws BadRequestException when the line belongs to another list.
	 */
	private async assertLineBelongsTo(pickListId: ID, lineId: ID): Promise<void> {
		const line = await this.pickListLineService.findOneScoped(lineId);

		if (String(line.pickListId) !== String(pickListId)) {
			throw new BadRequestException('The line does not belong to the pick list named in the request.');
		}
	}
}
