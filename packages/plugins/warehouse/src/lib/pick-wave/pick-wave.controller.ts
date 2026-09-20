import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID, IPagination } from '@gauzy/contracts';
import {
	BaseQueryDTO,
	CrudController,
	FeatureFlagGuard,
	Idempotent,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	UUIDValidationPipe,
	UseValidationPipe
} from '@gauzy/core';
import { FeatureFlag } from '@gauzy/common';
import { PickListService } from '../pick-list/pick-list.service';
import { WarehouseFeatures } from '../warehouse.features';
import { WarehousePermissions } from '../warehouse.permissions';
import { PickWave } from './pick-wave.entity';
import { PickWaveService } from './pick-wave.service';
import { CreatePickWaveDTO, PickWaveActionDTO, PickWaveDTO, UpdatePickWaveDTO } from './dto';

/**
 * The batches of picking work released to the floor.
 *
 * A wave is created from the shipments that are due to leave and it holds the pick lists derived into
 * it, so creating one is one operation rather than two: an empty wave is a configuration nobody wants,
 * and an operator who forgot the second call would have nothing to release.
 */
@ApiTags('PickWave')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(WarehouseFeatures.WAREHOUSE)
@Permissions(WarehousePermissions.PICK_LISTS_VIEW)
@Controller('/pick-waves')
export class PickWaveController extends CrudController<PickWave> {
	constructor(
		private readonly pickWaveService: PickWaveService,
		private readonly pickListService: PickListService
	) {
		super(pickWaveService);
	}

	/**
	 * Lists pick waves.
	 *
	 * @param options The filter, including `filter[status]` and `filter[warehouseId]`.
	 * @returns The waves, paginated.
	 */
	@ApiOperation({ summary: 'List pick waves' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The waves were listed.' })
	@Permissions(WarehousePermissions.PICK_LISTS_VIEW)
	@Get()
	async findAll(@Query() options: BaseQueryDTO<PickWave>): Promise<IPagination<PickWave>> {
		return await this.pickWaveService.findAll(options);
	}

	/**
	 * Reads a wave with its pick lists.
	 *
	 * @param id The wave.
	 * @returns The wave.
	 */
	@ApiOperation({ summary: 'Read a wave with its pick lists' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The wave was found.' })
	@Permissions(WarehousePermissions.PICK_LISTS_VIEW)
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<PickWave> {
		return await this.pickWaveService.findOneDetailed(id);
	}

	/**
	 * Creates a wave, and the picking work it covers.
	 *
	 * @param entity The wave to create, naming the shipments it covers.
	 * @returns The created wave.
	 */
	@ApiOperation({ summary: 'Create a wave from shipments' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The wave was created.' })
	@Permissions(WarehousePermissions.PICK_LISTS_EDIT)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreatePickWaveDTO): Promise<PickWave> {
		return await this.pickListService.createWaveWithLists({
			warehouseId: entity.warehouseId,
			fulfillmentIds: entity.fulfillmentIds,
			strategy: entity.strategy,
			priority: entity.priority,
			channelId: entity.channelId,
			plannedAt: entity.plannedAt
		});
	}

	/**
	 * Updates a wave that has not been released.
	 *
	 * @param id The wave.
	 * @param entity The fields to change.
	 * @returns The updated wave.
	 */
	@ApiOperation({ summary: 'Update a draft wave' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The wave was updated.' })
	@Permissions(WarehousePermissions.PICK_LISTS_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdatePickWaveDTO & PickWaveDTO
	): Promise<PickWave> {
		await this.pickWaveService.update(id, entity as any);

		return await this.pickWaveService.findOneDetailed(id);
	}

	/**
	 * Releases a wave to the floor.
	 *
	 * @param id The wave.
	 * @param entity The picker the wave is released to.
	 * @returns The released wave.
	 */
	@ApiOperation({ summary: 'Release a wave so picking can start' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The wave was released.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'A line of the wave has no bin.' })
	@Permissions(WarehousePermissions.PICK_LISTS_EDIT)
	@Idempotent({ scope: 'warehouse.release', required: false, resourceType: 'pick-wave' })
	@Post(':id/release')
	@UseValidationPipe({ transform: true, whitelist: true })
	async release(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: PickWaveActionDTO): Promise<PickWave> {
		return await this.pickWaveService.release(id, entity.pickerUserId);
	}

	/**
	 * Marks a released wave as being walked.
	 *
	 * @param id The wave.
	 * @returns The started wave.
	 */
	@ApiOperation({ summary: 'Start a released wave' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The wave was started.' })
	@Permissions(WarehousePermissions.PICK_LISTS_EDIT)
	@Post(':id/start')
	async start(@Param('id', UUIDValidationPipe) id: ID): Promise<PickWave> {
		return await this.pickWaveService.start(id);
	}

	/**
	 * Completes a wave whose lists are all done.
	 *
	 * @param id The wave.
	 * @returns The wave in its picked state.
	 */
	@ApiOperation({ summary: 'Complete a wave' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The wave was completed.' })
	@Permissions(WarehousePermissions.PICK_LISTS_EDIT)
	@Post(':id/complete')
	async complete(@Param('id', UUIDValidationPipe) id: ID): Promise<PickWave> {
		return await this.pickWaveService.complete(id);
	}

	/**
	 * Closes a wave whose output was packed and manifested.
	 *
	 * @param id The wave.
	 * @returns The closed wave.
	 */
	@ApiOperation({ summary: 'Close a wave' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The wave was closed.' })
	@Permissions(WarehousePermissions.PICK_LISTS_EDIT)
	@Idempotent({ scope: 'warehouse.close', required: false, resourceType: 'pick-wave' })
	@Post(':id/close')
	async close(@Param('id', UUIDValidationPipe) id: ID): Promise<PickWave> {
		return await this.pickWaveService.close(id);
	}

	/**
	 * Closes a wave short, releasing the work that will not be done.
	 *
	 * @param id The wave.
	 * @param entity Why it was closed short.
	 * @returns The wave, closed short.
	 */
	@ApiOperation({ summary: 'Close a wave short' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The wave was closed with at least one line short.' })
	@Permissions(WarehousePermissions.PICK_LISTS_CANCEL)
	@Post(':id/close-short')
	@UseValidationPipe({ transform: true, whitelist: true })
	async closeShort(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: PickWaveActionDTO): Promise<PickWave> {
		return await this.pickWaveService.closeShort(id, entity.reason);
	}

	/**
	 * Cancels a wave nothing has been picked from.
	 *
	 * @param id The wave.
	 * @param entity Why it was cancelled.
	 * @returns The cancelled wave.
	 */
	@ApiOperation({ summary: 'Cancel a wave' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The wave and its lists were cancelled.' })
	@Permissions(WarehousePermissions.PICK_LISTS_EDIT)
	@Post(':id/cancel')
	@UseValidationPipe({ transform: true, whitelist: true })
	async cancel(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: PickWaveActionDTO): Promise<PickWave> {
		return await this.pickWaveService.cancel(id, entity.reason);
	}
}
