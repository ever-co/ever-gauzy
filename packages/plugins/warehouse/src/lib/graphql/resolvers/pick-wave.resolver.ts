import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ID } from '@gauzy/contracts';
import { FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FeatureFlag } from '@gauzy/common';
import { PickListService } from '../../pick-list/pick-list.service';
import { PickList } from '../../pick-list/pick-list.entity';
import { WarehouseFeatures } from '../../warehouse.features';
import { WarehousePermissions } from '../../warehouse.permissions';
import { IPickWave, PickWaveStatus, PickWaveStrategy } from '../../warehouse.types';
import { PickWave } from '../../pick-wave/pick-wave.entity';
import { PickWaveService } from '../../pick-wave/pick-wave.service';
import { buildConnection, IPageSelection, resolveWindow } from '../../graphql/pagination';
import { toUserError } from '../../graphql/wire';

/**
 * The batches of picking work released to the floor.
 *
 * Creating a wave creates the work it covers, which is the same call the REST surface makes: an empty
 * wave is a configuration nobody wants, and the two surfaces have to agree about that.
 */
@Resolver('PickWave')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(WarehouseFeatures.WAREHOUSE)
export class PickWaveResolver {
	constructor(
		private readonly pickWaveService: PickWaveService,
		private readonly pickListService: PickListService
	) {}

	/**
	 * Lists waves.
	 *
	 * @param filter The wave filter.
	 * @param page The page.
	 * @returns One page of waves.
	 */
	@Permissions(WarehousePermissions.PICK_LISTS_VIEW)
	@Query('pickWaves')
	async pickWaves(
		@Args('filter')
		filter?: {
			warehouseId?: ID;
			status?: PickWaveStatus;
			strategy?: PickWaveStrategy;
			pickerUserId?: ID;
			number?: string;
		},
		@Args('page') page?: IPageSelection
	) {
		const { skip, take } = resolveWindow(page);
		const result = await this.pickWaveService.findAll({
			where: {
				...(filter?.warehouseId ? { warehouseId: filter.warehouseId } : {}),
				...(filter?.status ? { status: filter.status } : {}),
				...(filter?.strategy ? { strategy: filter.strategy } : {}),
				...(filter?.pickerUserId ? { pickerUserId: filter.pickerUserId } : {}),
				...(filter?.number ? { number: filter.number } : {})
			},
			skip,
			take,
			order: { createdAt: 'DESC' }
		} as any);

		return buildConnection(result, skip);
	}

	/**
	 * Reads one wave.
	 *
	 * @param id The wave.
	 * @returns The wave, or null when it is not the caller's.
	 */
	@Permissions(WarehousePermissions.PICK_LISTS_VIEW)
	@Query('pickWave')
	async pickWave(@Args('id') id: ID): Promise<PickWave | null> {
		try {
			return await this.pickWaveService.findOneDetailed(id);
		} catch (error) {
			return null;
		}
	}

	/**
	 * Creates a wave and the picking work it covers.
	 *
	 * @param input The wave.
	 * @returns The payload.
	 */
	@Permissions(WarehousePermissions.PICK_LISTS_EDIT)
	@Mutation('createPickWave')
	async createPickWave(
		@Args('input')
		input: {
			warehouseId: ID;
			channelId?: ID;
			priority?: number;
			plannedAt?: Date;
			strategy?: PickWaveStrategy;
			pickerUserId?: ID;
			fulfillmentIds?: ID[];
		}
	) {
		try {
			const wave = await this.pickListService.createWaveWithLists(input);

			return { pickWave: wave, userErrors: [] };
		} catch (error) {
			return { pickWave: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Releases a wave to the floor.
	 *
	 * @param id The wave.
	 * @param pickerUserId The picker the wave is released to.
	 * @returns The payload.
	 */
	@Permissions(WarehousePermissions.PICK_LISTS_EDIT)
	@Mutation('releasePickWave')
	async releasePickWave(@Args('id') id: ID, @Args('pickerUserId') pickerUserId?: ID) {
		try {
			return { pickWave: await this.pickWaveService.release(id, pickerUserId), userErrors: [] };
		} catch (error) {
			return { pickWave: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Marks a released wave as being walked.
	 *
	 * @param id The wave.
	 * @returns The payload.
	 */
	@Permissions(WarehousePermissions.PICK_LISTS_EDIT)
	@Mutation('startPickWave')
	async startPickWave(@Args('id') id: ID) {
		try {
			return { pickWave: await this.pickWaveService.start(id), userErrors: [] };
		} catch (error) {
			return { pickWave: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Completes a wave whose lists are all done.
	 *
	 * @param id The wave.
	 * @returns The payload.
	 */
	@Permissions(WarehousePermissions.PICK_LISTS_EDIT)
	@Mutation('completePickWave')
	async completePickWave(@Args('id') id: ID) {
		try {
			return { pickWave: await this.pickWaveService.complete(id), userErrors: [] };
		} catch (error) {
			return { pickWave: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Closes a wave whose output was packed and manifested.
	 *
	 * @param id The wave.
	 * @returns The payload.
	 */
	@Permissions(WarehousePermissions.PICK_LISTS_EDIT)
	@Mutation('closePickWave')
	async closePickWave(@Args('id') id: ID) {
		try {
			return { pickWave: await this.pickWaveService.close(id), userErrors: [] };
		} catch (error) {
			return { pickWave: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Closes a wave short.
	 *
	 * @param id The wave.
	 * @param reason Why it was closed short.
	 * @returns The payload.
	 */
	@Permissions(WarehousePermissions.PICK_LISTS_CANCEL)
	@Mutation('closePickWaveShort')
	async closePickWaveShort(@Args('id') id: ID, @Args('reason') reason?: string) {
		try {
			return { pickWave: await this.pickWaveService.closeShort(id, reason), userErrors: [] };
		} catch (error) {
			return { pickWave: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Cancels a wave nothing has been picked from.
	 *
	 * @param id The wave.
	 * @param reason Why it was cancelled.
	 * @returns The payload.
	 */
	@Permissions(WarehousePermissions.PICK_LISTS_EDIT)
	@Mutation('cancelPickWave')
	async cancelPickWave(@Args('id') id: ID, @Args('reason') reason?: string) {
		try {
			return { pickWave: await this.pickWaveService.cancel(id, reason), userErrors: [] };
		} catch (error) {
			return { pickWave: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Resolves the lists a wave holds.
	 *
	 * @param wave The wave being read.
	 * @returns The pick lists.
	 */
	@Permissions(WarehousePermissions.PICK_LISTS_VIEW)
	@ResolveField('pickLists')
	async pickLists(@Parent() wave: IPickWave): Promise<PickList[]> {
		if (Array.isArray((wave as PickWave).pickLists)) {
			return (wave as PickWave).pickLists;
		}

		const result = await this.pickListService.findAll({
			where: { waveId: wave.id },
			order: { priority: 'DESC', createdAt: 'ASC' }
		} as any);

		return result.items;
	}
}
