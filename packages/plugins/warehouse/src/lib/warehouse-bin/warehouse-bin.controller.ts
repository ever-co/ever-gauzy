import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DeleteResult } from 'typeorm';
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
	UseValidationPipe,
	Versioned
} from '@gauzy/core';
import { FeatureFlag } from '@gauzy/common';
import { IBinReconciliationReport, IWarehouseBinCapacityCheck, IWarehousePutAwayResult } from '../warehouse.types';
import { WarehouseFeatures } from '../warehouse.features';
import { WarehousePermissions } from '../warehouse.permissions';
import { WarehouseBin } from './warehouse-bin.entity';
import { WarehouseBinService } from './warehouse-bin.service';
import {
	AssignWarehouseBinDTO,
	BlockWarehouseBinDTO,
	CheckWarehouseBinCapacityDTO,
	CreateWarehouseBinDTO,
	CreateWarehouseBinRangeDTO,
	PutAwayWarehouseBinDTO,
	ReconcileWarehouseBinDTO,
	ReparentWarehouseBinDTO,
	UpdateWarehouseBinDTO,
	WarehouseBinDTO
} from './dto';

/**
 * The positions inside a location.
 *
 * A bin is addressed by the labels printed on a pick list, so the surface separates the three edits
 * that change an address — re-coding, re-parenting and blocking — from the ordinary field update,
 * because each of them has a consequence for documents that already exist.
 */
@ApiTags('WarehouseBin')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(WarehouseFeatures.WAREHOUSE)
@Permissions(WarehousePermissions.WAREHOUSE_BINS_VIEW)
@Controller('/warehouse-bins')
export class WarehouseBinController extends CrudController<WarehouseBin> {
	constructor(private readonly warehouseBinService: WarehouseBinService) {
		super(warehouseBinService);
	}

	/**
	 * Lists the bins of a location.
	 *
	 * @param options The filter, including `filter[zoneId]`, `filter[warehouseId]` and `filter[parentId]`.
	 * @returns The bins, paginated.
	 */
	@ApiOperation({ summary: 'List warehouse bins' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The bins were listed.' })
	@Permissions(WarehousePermissions.WAREHOUSE_BINS_VIEW)
	@Get()
	async findAll(@Query() options: BaseQueryDTO<WarehouseBin>): Promise<IPagination<WarehouseBin>> {
		return await this.warehouseBinService.findAll(options);
	}

	/**
	 * Lists the bins whose capacity is declared without the unit it is counted in.
	 *
	 * The route is mapped before the by-id route on purpose: a literal segment declared after `:id`
	 * would be captured by it and refused as a malformed identifier instead of being served.
	 *
	 * @param warehouseId The location, when the caller wants one location only.
	 * @returns One entry per bin with an undeclared capacity unit, pallet positions first.
	 */
	@ApiOperation({ summary: 'List bins whose capacity unit is undeclared' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The bins whose capacity cannot be interpreted were listed.' })
	@Permissions(WarehousePermissions.WAREHOUSE_BINS_VIEW)
	@Get('/capacity-warnings')
	async capacityWarnings(@Query('warehouseId') warehouseId?: ID) {
		return await this.warehouseBinService.capacityWarnings(warehouseId);
	}

	/**
	 * Reads a bin with its area, its parent and its children.
	 *
	 * @param id The bin.
	 * @returns The bin.
	 */
	@ApiOperation({ summary: 'Read a bin with its place in the hierarchy' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The bin was found.' })
	@Permissions(WarehousePermissions.WAREHOUSE_BINS_VIEW)
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<WarehouseBin> {
		return await this.warehouseBinService.findOneDetailed(id);
	}

	/**
	 * Measures a request against a bin's declared capacity.
	 *
	 * The route is mapped before the by-id route so `/capacity-check` is not read as an identifier.
	 *
	 * @param entity The bin, the requested quantity and the factor that converts it when the request is
	 * in another unit.
	 * @returns The comparison, with its notices.
	 */
	@ApiOperation({ summary: 'Measure a requested quantity against a bin capacity' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The request was measured against the declared capacity.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'The quantity is not an exact decimal.' })
	@Permissions(WarehousePermissions.WAREHOUSE_BINS_VIEW)
	@Post('/capacity-check')
	@UseValidationPipe({ transform: true, whitelist: true })
	async capacityCheck(@Body() entity: CheckWarehouseBinCapacityDTO): Promise<IWarehouseBinCapacityCheck> {
		return await this.warehouseBinService.checkCapacity(entity);
	}

	/**
	 * Reads the derived contents of a bin.
	 *
	 * @param id The bin.
	 * @returns One balance per variant the bin holds.
	 */
	@ApiOperation({ summary: 'Read the derived contents of a bin' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The contents were derived from the ledger.' })
	@Permissions(WarehousePermissions.WAREHOUSE_BINS_VIEW)
	@Get(':id/contents')
	async contents(@Param('id', UUIDValidationPipe) id: ID) {
		return await this.warehouseBinService.findContents(id);
	}

	/**
	 * Reads everything under a bin.
	 *
	 * @param id The root of the subtree.
	 * @returns The subtree, in walking order.
	 */
	@ApiOperation({ summary: 'Read every position under a bin' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The subtree was read through the closure table.' })
	@Permissions(WarehousePermissions.WAREHOUSE_BINS_VIEW)
	@Get(':id/subtree')
	async subtree(@Param('id', UUIDValidationPipe) id: ID): Promise<WarehouseBin[]> {
		return await this.warehouseBinService.findSubtree(id);
	}

	/**
	 * Creates a bin, optionally nested inside another.
	 *
	 * @param entity The bin to create.
	 * @returns The created bin.
	 */
	@ApiOperation({ summary: 'Create a bin' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The bin was created.' })
	@Permissions(WarehousePermissions.WAREHOUSE_BINS_CREATE)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateWarehouseBinDTO): Promise<WarehouseBin> {
		return await this.warehouseBinService.create(entity as any);
	}

	/**
	 * Creates a consecutive range of bins.
	 *
	 * @param entity The range to create.
	 * @returns The created bins.
	 */
	@ApiOperation({ summary: 'Create a range of bins' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The range was created.' })
	@Permissions(WarehousePermissions.WAREHOUSE_BINS_CREATE)
	@HttpCode(HttpStatus.CREATED)
	@Post('/bulk')
	@UseValidationPipe({ transform: true, whitelist: true })
	async createRange(@Body() entity: CreateWarehouseBinRangeDTO): Promise<WarehouseBin[]> {
		return await this.warehouseBinService.createRange(entity);
	}

	/**
	 * Updates a bin.
	 *
	 * @param id The bin.
	 * @param entity The fields to change.
	 * @returns The updated bin.
	 */
	@ApiOperation({ summary: 'Update a bin' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The bin was updated.' })
	@Permissions(WarehousePermissions.WAREHOUSE_BINS_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateWarehouseBinDTO & WarehouseBinDTO
	): Promise<WarehouseBin> {
		return await this.warehouseBinService.update(id, entity as any);
	}

	/**
	 * Moves a bin and its subtree inside its zone.
	 *
	 * @param id The bin.
	 * @param entity The new parent.
	 * @returns The moved bin.
	 */
	@ApiOperation({ summary: 'Move a bin in the hierarchy' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The bin was moved.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'The move would create a cycle.' })
	@Permissions(WarehousePermissions.WAREHOUSE_BINS_EDIT)
	@Idempotent({ scope: 'warehouse.move', required: false, resourceType: 'warehouse-bin' })
	@Post(':id/reparent')
	@UseValidationPipe({ transform: true, whitelist: true })
	async reparent(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: ReparentWarehouseBinDTO
	): Promise<WarehouseBin> {
		return await this.warehouseBinService.reparent(id, entity.parentId ?? null);
	}

	/**
	 * Takes a bin out of service.
	 *
	 * @param id The bin.
	 * @returns The blocked bin.
	 */
	@ApiOperation({ summary: 'Block a bin' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The bin was blocked; the stock in it did not move.' })
	@Permissions(WarehousePermissions.WAREHOUSE_BINS_EDIT)
	@Post(':id/block')
	@UseValidationPipe({ transform: true, whitelist: true })
	async block(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: BlockWarehouseBinDTO): Promise<WarehouseBin> {
		void entity;

		return await this.warehouseBinService.setBlocked(id, true);
	}

	/**
	 * Puts a blocked bin back into service.
	 *
	 * @param id The bin.
	 * @returns The unblocked bin.
	 */
	@ApiOperation({ summary: 'Unblock a bin' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The bin was unblocked.' })
	@Permissions(WarehousePermissions.WAREHOUSE_BINS_EDIT)
	@Post(':id/unblock')
	@UseValidationPipe({ transform: true, whitelist: true })
	async unblock(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: BlockWarehouseBinDTO): Promise<WarehouseBin> {
		void entity;

		return await this.warehouseBinService.setBlocked(id, false);
	}

	/**
	 * Declares this bin as the bin a variant is kept in at its location.
	 *
	 * No movement is written: nothing physically moved, and the declaration is what reconciliation later
	 * checks the placement against.
	 *
	 * @param id The bin being named.
	 * @param entity The variant and the location the declaration is about.
	 * @returns Whether the declaration was written.
	 */
	@ApiOperation({ summary: 'Declare a bin as the home bin of a variant at a location' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The home bin was declared; no stock moved.' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'The level moved past the version the declaration was based on.' })
	@ApiResponse({ status: HttpStatus.PRECONDITION_REQUIRED, description: 'The version the declaration was based on was not stated.' })
	@Permissions(WarehousePermissions.WAREHOUSE_BINS_EDIT)
	@Versioned()
	@Post(':id/assign')
	@UseValidationPipe({ transform: true, whitelist: true })
	async assign(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: AssignWarehouseBinDTO): Promise<boolean> {
		return await this.warehouseBinService.assignHomeBin(id, entity);
	}

	/**
	 * Walks received units from the receiving area into this bin.
	 *
	 * @param id The bin the units are placed into.
	 * @param entity The variant, the quantity and where the units walk from.
	 * @returns What the ledger wrote, including the level the walk produced.
	 */
	@ApiOperation({ summary: 'Put received units away into a bin' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The units were walked into the bin.' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'The level moved past the version the walk was based on.' })
	@ApiResponse({ status: HttpStatus.PRECONDITION_REQUIRED, description: 'The version the walk was based on was not stated.' })
	@Permissions(WarehousePermissions.WAREHOUSE_BINS_EDIT)
	@Versioned()
	@Idempotent({ scope: 'warehouse.put-away', required: false, resourceType: 'warehouse-bin' })
	@Post(':id/put-away')
	@UseValidationPipe({ transform: true, whitelist: true })
	async putAway(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: PutAwayWarehouseBinDTO
	): Promise<IWarehousePutAwayResult> {
		return await this.warehouseBinService.putAway(id, entity);
	}

	/**
	 * Reconciles the bins of a location against the movement ledger.
	 *
	 * @param entity The scope of the run and whether it should repair what it finds.
	 * @returns What the run found, per bin and variant.
	 */
	@ApiOperation({ summary: 'Reconcile bin stock against the ledger' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The bins were reconciled.' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'A level moved past the version the run was based on.' })
	@Permissions(WarehousePermissions.WAREHOUSE_BINS_EDIT)
	@Versioned({ required: false })
	@Idempotent({ scope: 'warehouse.count', required: false, resourceType: 'warehouse-bin' })
	@Post('/reconcile')
	@UseValidationPipe({ transform: true, whitelist: true })
	async reconcile(@Body() entity: ReconcileWarehouseBinDTO): Promise<IBinReconciliationReport> {
		return await this.warehouseBinService.reconcile(entity);
	}

	/**
	 * Deletes a bin that is empty and holds no position under it.
	 *
	 * @param id The bin.
	 * @returns The delete result.
	 */
	@ApiOperation({ summary: 'Delete an empty bin' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The bin was deleted.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'The bin holds stock or children.' })
	@Permissions(WarehousePermissions.WAREHOUSE_BINS_DELETE)
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<DeleteResult> {
		return await this.warehouseBinService.delete(id);
	}
}
