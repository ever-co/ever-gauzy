import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards, UsePipes } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID, IPagination } from '@gauzy/contracts';
import {
	AbstractValidationPipe,
	BaseQueryDTO,
	CrudController,
	FeatureFlagGuard,
	Idempotent,
	PermissionGuard,
	Permissions,
	TenantOrganizationBaseDTO,
	TenantPermissionGuard,
	UUIDValidationPipe,
	UseValidationPipe,
	Versioned
} from '@gauzy/core';
import { FeatureFlag } from '@gauzy/common';
import { PickListLine } from '../pick-list-line/pick-list-line.entity';
import { PickListLineService } from '../pick-list-line/pick-list-line.service';
import { WarehouseFeatures } from '../warehouse.features';
import { WarehousePermissions } from '../warehouse.permissions';
import { PickList } from './pick-list.entity';
import { PickListService } from './pick-list.service';
import {
	CreatePickListDTO,
	PickListActionDTO,
	PickListDTO,
	PickListLineOutcomeDTO,
	PickListLineSubstitutionDTO,
	UpdatePickListDTO
} from './dto';

/**
 * The work, per picker.
 *
 * Confirming a line is a permission of its own — `PICK_LISTS_PICK` — because the person who walks the
 * aisle is not the person who releases the work, and the surface keeps the two apart rather than
 * letting the right to plan imply the right to record.
 */
@ApiTags('PickList')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(WarehouseFeatures.WAREHOUSE)
@Permissions(WarehousePermissions.PICK_LISTS_VIEW)
@Controller('/pick-lists')
export class PickListController extends CrudController<PickList> {
	constructor(
		private readonly pickListService: PickListService,
		private readonly pickListLineService: PickListLineService
	) {
		super(pickListService);
	}

	/**
	 * Lists pick lists.
	 *
	 * @param options The filter, including `filter[waveId]`, `filter[status]` and `filter[warehouseId]`.
	 * @returns The lists, paginated.
	 */
	@ApiOperation({ summary: 'List pick lists' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The lists were listed.' })
	@Permissions(WarehousePermissions.PICK_LISTS_VIEW)
	@Get()
	async findAll(@Query() options: BaseQueryDTO<PickList>): Promise<IPagination<PickList>> {
		return await this.pickListService.findAll(options);
	}

	/**
	 * Reads a list with its lines and the bins they name.
	 *
	 * @param id The list.
	 * @returns The list.
	 */
	@ApiOperation({ summary: 'Read a pick list with its lines' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The list was found.' })
	@Permissions(WarehousePermissions.PICK_LISTS_VIEW)
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<PickList> {
		return await this.pickListService.findOneDetailed(id);
	}

	/**
	 * Creates a pick list from shipments.
	 *
	 * @param entity The list to create, naming the shipments it serves.
	 * @returns The created list.
	 */
	@ApiOperation({ summary: 'Create a pick list from shipments' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The list was created with its lines.' })
	@Permissions(WarehousePermissions.PICK_LISTS_EDIT)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreatePickListDTO): Promise<PickList> {
		return await this.pickListService.create(entity as any);
	}

	/**
	 * Updates a list that has not been picked from.
	 *
	 * @param id The list.
	 * @param entity The fields to change.
	 * @returns The updated list.
	 */
	@ApiOperation({ summary: 'Update a pick list' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The list was updated.' })
	@Permissions(WarehousePermissions.PICK_LISTS_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdatePickListDTO & PickListDTO
	): Promise<PickList> {
		await this.pickListService.update(id, entity as any);

		return await this.pickListService.findOneDetailed(id);
	}

	/**
	 * Assigns a list to a picker.
	 *
	 * @param id The list.
	 * @param entity The picker.
	 * @returns The assigned list.
	 */
	@ApiOperation({ summary: 'Assign a pick list to a picker' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The list was assigned.' })
	@Permissions(WarehousePermissions.PICK_LISTS_EDIT)
	@Post(':id/assign')
	@UseValidationPipe({ transform: true, whitelist: true })
	async assign(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: PickListActionDTO): Promise<PickList> {
		return await this.pickListService.assign(id, entity.assignedToUserId);
	}

	/**
	 * Marks a list as being walked.
	 *
	 * @param id The list.
	 * @returns The started list.
	 */
	@ApiOperation({ summary: 'Start a pick list' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The list was started.' })
	@Permissions(WarehousePermissions.PICK_LISTS_EDIT)
	@Post(':id/start')
	async start(@Param('id', UUIDValidationPipe) id: ID): Promise<PickList> {
		return await this.pickListService.start(id);
	}

	/**
	 * Completes a list whose lines all reached an outcome.
	 *
	 * @param id The list.
	 * @returns The completed list.
	 */
	@ApiOperation({ summary: 'Complete a pick list' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The list was completed.' })
	@Permissions(WarehousePermissions.PICK_LISTS_EDIT)
	@Post(':id/complete')
	async complete(@Param('id', UUIDValidationPipe) id: ID): Promise<PickList> {
		return await this.pickListService.complete(id);
	}

	/**
	 * Cancels a list nothing has been picked from.
	 *
	 * @param id The list.
	 * @param entity Why it was cancelled.
	 * @returns The cancelled list.
	 */
	@ApiOperation({ summary: 'Cancel a pick list' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The list was cancelled.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'The list already has recorded outcomes.' })
	@Permissions(WarehousePermissions.PICK_LISTS_EDIT)
	@Post(':id/cancel')
	@UseValidationPipe({ transform: true, whitelist: true })
	async cancel(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: PickListActionDTO): Promise<PickList> {
		return await this.pickListService.cancel(id, entity.reason);
	}

	/**
	 * Delete a pick list.
	 *
	 * The `DELETE ':id'` route belongs to `CrudController`, and this override exists only to state the
	 * permission it demands. The base declares the route with no permission metadata at all, so
	 * `PermissionGuard` (`packages/core/src/lib/shared/guards/permission.guard.ts`) answers `true` to that
	 * empty metadata with its `isEmpty(permissions)` return, which left the inherited handler standing on
	 * this controller's class-level read grant alone. It now states `PICK_LISTS_EDIT`, the grant the
	 * plugin's own `cancelPickList` mutation carries, so both surfaces ask the same caller.
	 *
	 * @param id The list to delete.
	 * @returns The delete result.
	 */
	@ApiOperation({ summary: 'Delete a pick list' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The list was deleted.' })
	@Permissions(WarehousePermissions.PICK_LISTS_EDIT)
	@Delete(':id')
	@HttpCode(HttpStatus.ACCEPTED)
	async delete(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return super.delete(id);
	}

	/**
	 * Soft delete a pick list.
	 *
	 * The `DELETE ':id/soft'` route belongs to `CrudController`, and this override exists only to state the
	 * permission it demands. The base declares the route with no permission metadata at all, so
	 * `PermissionGuard` (`packages/core/src/lib/shared/guards/permission.guard.ts`) answers `true` to that
	 * empty metadata with its `isEmpty(permissions)` return, which left the inherited handler standing on
	 * this controller's class-level read grant alone. It now states `PICK_LISTS_EDIT`, the same grant the
	 * delete route above states.
	 *
	 * @param id The list to soft delete.
	 * @returns The soft-deleted list.
	 */
	@ApiOperation({ summary: 'Soft delete a pick list' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The list was soft deleted.' })
	@Permissions(WarehousePermissions.PICK_LISTS_EDIT)
	@Delete(':id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restore a soft-deleted pick list.
	 *
	 * The `PUT ':id/recover'` route belongs to `CrudController`, and this override exists only to state the
	 * permission it demands. The base declares the route with no permission metadata at all, so
	 * `PermissionGuard` (`packages/core/src/lib/shared/guards/permission.guard.ts`) answers `true` to that
	 * empty metadata with its `isEmpty(permissions)` return, which left the inherited handler standing on
	 * this controller's class-level read grant alone. It now states `PICK_LISTS_EDIT` — restoring is the
	 * same grant exercised backwards, exactly as the delete route above states it.
	 *
	 * @param id The list to restore.
	 * @returns The restored list.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted pick list' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The list was restored.' })
	@Permissions(WarehousePermissions.PICK_LISTS_EDIT)
	@Put(':id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRecover(id, ...options);
	}

	/**
	 * Reads the lines of a list, in the order the pick path visits them.
	 *
	 * @param id The list.
	 * @returns The lines.
	 */
	@ApiOperation({ summary: 'Read the lines of a pick list' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The lines were listed.' })
	@Permissions(WarehousePermissions.PICK_LISTS_VIEW)
	@Get(':id/lines')
	async lines(@Param('id', UUIDValidationPipe) id: ID): Promise<PickListLine[]> {
		return await this.pickListLineService.findForList(id);
	}

	/**
	 * Records what was taken from the bin.
	 *
	 * @param id The list.
	 * @param lineId The line.
	 * @param entity What was picked.
	 * @returns The recorded line.
	 */
	@ApiOperation({ summary: 'Record a pick against a line' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The outcome was recorded.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'More was taken than the list asked for.' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'A level moved past the version the pick was based on.' })
	@Permissions(WarehousePermissions.PICK_LISTS_PICK)
	@Versioned({ required: false })
	@Idempotent({ scope: 'warehouse.pick', required: false, resourceType: 'pick-list-line' })
	@Post(':id/lines/:lineId/pick')
	@UseValidationPipe({ transform: true, whitelist: true })
	async pick(
		@Param('id', UUIDValidationPipe) id: ID,
		@Param('lineId', UUIDValidationPipe) lineId: ID,
		@Body() entity: PickListLineOutcomeDTO
	): Promise<PickListLine> {
		await this.assertLineBelongsTo(id, lineId);

		return await this.pickListLineService.recordPick(lineId, {
			pickedQuantity: entity.pickedQuantity,
			binId: entity.binId,
			lotNumber: entity.lotNumber,
			serialNumbers: entity.serialNumbers,
			note: entity.note
		});
	}

	/**
	 * Records a substitute: a different unit was taken instead of the one the list named.
	 *
	 * @param id The list.
	 * @param lineId The line.
	 * @param entity The substitute the picker took.
	 * @returns The recorded line.
	 */
	@ApiOperation({ summary: 'Record a substitution against a line' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The substitution was recorded.' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'A level moved past the version the swap was based on.' })
	@Permissions(WarehousePermissions.PICK_LISTS_PICK)
	@Versioned({ required: false })
	@Idempotent({ scope: 'warehouse.substitute', required: false, resourceType: 'pick-list-line' })
	@Post(':id/lines/:lineId/substitute')
	@UseValidationPipe({ transform: true, whitelist: true })
	async substitute(
		@Param('id', UUIDValidationPipe) id: ID,
		@Param('lineId', UUIDValidationPipe) lineId: ID,
		@Body() entity: PickListLineSubstitutionDTO
	): Promise<PickListLine> {
		await this.assertLineBelongsTo(id, lineId);

		return await this.pickListLineService.recordSubstitution(lineId, {
			substituteVariantId: entity.substituteVariantId,
			substituteQuantity: entity.substituteQuantity,
			substitutionReason: entity.substitutionReason,
			binId: entity.binId,
			note: entity.note
		});
	}

	/**
	 * Records a line the picker deliberately did not collect.
	 *
	 * @param id The list.
	 * @param lineId The line.
	 * @param entity Why it was skipped.
	 * @returns The recorded line.
	 */
	@ApiOperation({ summary: 'Record a skipped line' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The line was closed as skipped.' })
	@Permissions(WarehousePermissions.PICK_LISTS_PICK)
	@Post(':id/lines/:lineId/skip')
	@UseValidationPipe({ transform: true, whitelist: true })
	async skip(
		@Param('id', UUIDValidationPipe) id: ID,
		@Param('lineId', UUIDValidationPipe) lineId: ID,
		@Body() entity: PickListLineOutcomeDTO
	): Promise<PickListLine> {
		await this.assertLineBelongsTo(id, lineId);

		return await this.pickListLineService.recordSkip(lineId, entity.note);
	}

	/**
	 * Asserts that a line is one of a list's own, so a path that names both cannot cross them.
	 *
	 * @param pickListId The list in the path.
	 * @param lineId The line in the path.
	 * @throws BadRequestException when the line belongs to another list.
	 */
	private async assertLineBelongsTo(pickListId: ID, lineId: ID): Promise<void> {
		const line = await this.pickListLineService.findOneScoped(lineId);

		if (String(line.pickListId) !== String(pickListId)) {
			throw new BadRequestException('The line does not belong to the pick list named in the request.');
		}
	}
}
