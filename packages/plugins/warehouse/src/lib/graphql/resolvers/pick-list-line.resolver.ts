import { BadRequestException, UseGuards } from '@nestjs/common';
import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { ID } from '@gauzy/contracts';
import { FeatureFlagGuard, Idempotent, PermissionGuard, Permissions, TenantPermissionGuard, Versioned } from '@gauzy/core';
import { FeatureFlag } from '@gauzy/common';
import { PickListLine } from '../../pick-list-line/pick-list-line.entity';
import { PickListLineService } from '../../pick-list-line/pick-list-line.service';
import { WarehouseBin } from '../../warehouse-bin/warehouse-bin.entity';
import { WarehouseBinService } from '../../warehouse-bin/warehouse-bin.service';
import { WarehouseFeatures } from '../../warehouse.features';
import { WarehousePermissions } from '../../warehouse.permissions';
import { IPickListLine } from '../../warehouse.types';
import { toUserError } from '../../graphql/wire';

/**
 * The lines of a pick list: what was asked for, from which bin, and what actually happened.
 *
 * The three outcomes live here because each of them is a statement about a line, and each of them is
 * guarded by `PICK_LISTS_PICK` rather than by the permission that releases the work — a picker holds
 * one without holding the other, and the two surfaces keep that apart in the same way.
 */
@Resolver('PickListLine')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(WarehouseFeatures.WAREHOUSE)
export class PickListLineResolver {
	constructor(
		private readonly pickListLineService: PickListLineService,
		private readonly warehouseBinService: WarehouseBinService
	) {}

	/**
	 * Reads the lines of a list.
	 *
	 * @param pickListId The list.
	 * @returns The lines, in the order the pick path visits them.
	 */
	@Permissions(WarehousePermissions.PICK_LISTS_VIEW)
	@Query('pickListLines')
	async pickListLines(@Args('pickListId') pickListId: ID): Promise<PickListLine[]> {
		return await this.pickListLineService.findForList(pickListId);
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
	@Versioned({ required: false })
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
	@Versioned({ required: false })
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
