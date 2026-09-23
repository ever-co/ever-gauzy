import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ID } from '@gauzy/contracts';
import { FeatureFlagGuard, Idempotent, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
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

/** The patch `PUT /pick-waves/:id` accepts, as the route's own body declares it. */
interface IUpdatePickWaveInput {
	warehouseId?: ID;
	channelId?: ID;
	number?: string;
	strategy?: PickWaveStrategy;
	status?: PickWaveStatus;
	priority?: number;
	pickerUserId?: ID;
	plannedAt?: Date;
	releasedAt?: Date;
	startedAt?: Date;
	completedAt?: Date;
	orderCount?: number;
	lineCount?: number;
	version?: number;
	metadata?: Record<string, unknown>;
}

/**
 * The batches of picking work released to the floor.
 *
 * Creating a wave creates the work it covers, which is the same call the REST surface makes: an empty
 * wave is a configuration nobody wants, and the two surfaces have to agree about that.
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
@Resolver('PickWave')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
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
	 * @param withDeleted Whether the retired waves are included.
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
		@Args('page') page?: IPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
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
			order: { createdAt: 'DESC' },
			...(withDeleted ? { withDeleted: true } : {})
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
	 * Edits a wave that has not been released.
	 *
	 * The route it mirrors is `PUT /pick-waves/:id`, and both of its calls are reproduced rather than
	 * collapsed: the write, and the read back through `findOneDetailed`. The route answers the wave as
	 * the edit left it, and a field that answered the update's own result would hand a client a row
	 * without the lists and the re-derived counters the detail read carries — two surfaces describing
	 * one edit differently.
	 *
	 * The route declares no version precondition, so this field declares none either: a version
	 * expectation invented here would refuse over GraphQL an edit the REST route accepts, which is a
	 * difference in behaviour rather than in transport.
	 *
	 * @param id The wave.
	 * @param input The fields to change.
	 * @returns The payload, with the wave as the edit left it.
	 */
	@Permissions(WarehousePermissions.PICK_LISTS_EDIT)
	@Mutation('updatePickWave')
	async updatePickWave(@Args('id') id: ID, @Args('input') input: IUpdatePickWaveInput) {
		try {
			await this.pickWaveService.update(id, input as any);

			return { pickWave: await this.pickWaveService.findOneDetailed(id), userErrors: [] };
		} catch (error) {
			return { pickWave: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Releases a wave to the floor.
	 *
	 * @param id The wave.
	 * @param pickerUserId The picker the wave is released to.
	 * @param idempotencyKey The key a retry presents, matching the REST route's scope.
	 * @returns The payload.
	 */
	@Permissions(WarehousePermissions.PICK_LISTS_EDIT)
	@Mutation('releasePickWave')
	@Idempotent({ scope: 'warehouse.release', required: false, resourceType: 'pick-wave' })
	async releasePickWave(
		@Args('id') id: ID,
		@Args('pickerUserId') pickerUserId?: ID,
		@Args('idempotencyKey', { type: () => String, nullable: true }) idempotencyKey?: string
	) {
		void idempotencyKey;

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
	 * @param idempotencyKey The key a retry presents, matching the REST route's scope.
	 * @returns The payload.
	 */
	@Permissions(WarehousePermissions.PICK_LISTS_EDIT)
	@Mutation('closePickWave')
	@Idempotent({ scope: 'warehouse.close', required: false, resourceType: 'pick-wave' })
	async closePickWave(
		@Args('id') id: ID,
		@Args('idempotencyKey', { type: () => String, nullable: true }) idempotencyKey?: string
	) {
		void idempotencyKey;

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
	 * Deletes a wave outright, destroying the lists and the picked work it records.
	 *
	 * The route it mirrors is `DELETE /pick-waves/:id`, inherited from `CrudController` and overridden
	 * by the controller only to state the permission the base left unstated. This is the **destructive**
	 * removal: the row is gone rather than retired, and the whole subtree of picking work that names it
	 * goes with it, which is why the answer carries no row to read back — the row the route's own answer
	 * described no longer exists. `softDeletePickWave` beside it is the recoverable pair, and it is the
	 * one a caller who may want the wave back has to use: a wave retired that way keeps its lists and
	 * the work they record and `recoverPickWave` brings it back.
	 *
	 * It is delivered because the same `CrudController` route is already mirrored for the two layout
	 * resources of this plugin (`deleteWarehouseBin`, `deleteWarehouseZone`): leaving the aggregate's
	 * own destructive route unmirrored while a bin's is a door would be one plugin answering one route
	 * two ways, and a REST caller could remove a wave a GraphQL caller could not.
	 *
	 * @param id The wave to delete.
	 * @returns The payload, empty of the row that was removed, or the refusal in `userErrors`.
	 */
	@Permissions(WarehousePermissions.PICK_LISTS_EDIT)
	@Mutation('deletePickWave')
	async deletePickWave(@Args('id') id: ID) {
		try {
			await this.pickWaveService.delete(id);

			return { pickWave: null, userErrors: [] };
		} catch (error) {
			return { pickWave: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Retires a wave recoverably, keeping the lists it released and the work they record.
	 *
	 * The route it mirrors is `DELETE /pick-waves/:id/soft`, inherited from `CrudController` and overridden
	 * by the controller only to state the permission the base left unstated. Cancelling is a transition of
	 * the wave's own lifecycle and refuses a wave work has been picked from, so it is not a substitute for
	 * this: without this field a wave a caller retired over GraphQL had no field to bring it back, while a
	 * REST caller could retire and restore it.
	 *
	 * The permission is the controller's own for the route — `PICK_LISTS_EDIT` — and not the class-level
	 * view grant, because retiring a wave takes the work it covers out of the floor's view.
	 *
	 * @param id The wave to retire.
	 * @returns The payload, with the retired wave or the reason it was refused.
	 */
	@Permissions(WarehousePermissions.PICK_LISTS_EDIT)
	@Mutation('softDeletePickWave')
	async softDeletePickWave(@Args('id') id: ID) {
		try {
			return { pickWave: await this.pickWaveService.softRemove(id), userErrors: [] };
		} catch (error) {
			return { pickWave: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Restores a wave that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /pick-waves/:id/recover`, inherited from `CrudController` and overridden
	 * by the controller only to state the permission the base left unstated. A restored wave holds its
	 * lists again, which is why the route states the editing grant rather than the reading one.
	 *
	 * @param id The wave to restore.
	 * @returns The payload, with the restored wave or the reason it was refused.
	 */
	@Permissions(WarehousePermissions.PICK_LISTS_EDIT)
	@Mutation('recoverPickWave')
	async recoverPickWave(@Args('id') id: ID) {
		try {
			return { pickWave: await this.pickWaveService.softRecover(id), userErrors: [] };
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
