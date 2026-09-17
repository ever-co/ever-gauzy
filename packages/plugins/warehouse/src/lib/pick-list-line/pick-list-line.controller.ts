import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID, IPagination } from '@gauzy/contracts';
import {
	BaseQueryDTO,
	CrudController,
	FeatureFlagGuard,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	UUIDValidationPipe,
	UseValidationPipe
} from '@gauzy/core';
import { FeatureFlag } from '@gauzy/common';
import { WarehouseFeatures } from '../warehouse.features';
import { WarehousePermissions } from '../warehouse.permissions';
import { CreatePickListLineDTO, UpdatePickListLineDTO } from './dto';
import { PickListLine } from './pick-list-line.entity';
import { PickListLineService } from './pick-list-line.service';

/**
 * The lines of a pick list.
 *
 * Lines are almost always derived from a shipment, and this surface exists for the two cases that are
 * not derivation: a replenishment line, which serves no order, and the corrected line an operator
 * writes by hand. Recording an outcome is deliberately not here — a pick, a substitution and a skip
 * each carry a stock consequence, so each of them has its own route on the list they belong to.
 */
@ApiTags('PickListLine')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(WarehouseFeatures.WAREHOUSE)
@Permissions(WarehousePermissions.PICK_LISTS_VIEW)
@Controller('/pick-list-lines')
export class PickListLineController extends CrudController<PickListLine> {
	constructor(private readonly pickListLineService: PickListLineService) {
		super(pickListLineService);
	}

	/**
	 * Lists pick lines.
	 *
	 * @param options The filter, including `filter[pickListId]` and `filter[status]`.
	 * @returns The lines, paginated.
	 */
	@ApiOperation({ summary: 'List pick lines' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The lines were listed.' })
	@Permissions(WarehousePermissions.PICK_LISTS_VIEW)
	@Get()
	async findAll(@Query() options: BaseQueryDTO<PickListLine>): Promise<IPagination<PickListLine>> {
		return await this.pickListLineService.findAll(options);
	}

	/**
	 * Reads a line.
	 *
	 * @param id The line.
	 * @returns The line.
	 */
	@ApiOperation({ summary: 'Read a pick line' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The line was found.' })
	@Permissions(WarehousePermissions.PICK_LISTS_VIEW)
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<PickListLine> {
		return await this.pickListLineService.findOneScoped(id);
	}

	/**
	 * Adds a line to a list that is still open.
	 *
	 * @param entity The line to add.
	 * @returns The created line.
	 */
	@ApiOperation({ summary: 'Add a line to a pick list' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The line was created.' })
	@Permissions(WarehousePermissions.PICK_LISTS_EDIT)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreatePickListLineDTO): Promise<PickListLine> {
		return await this.pickListLineService.create(entity as any);
	}

	/**
	 * Updates a line that has not been visited.
	 *
	 * @param id The line.
	 * @param entity The fields to change.
	 * @returns The updated line.
	 */
	@ApiOperation({ summary: 'Update a pick line' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The line was updated.' })
	@Permissions(WarehousePermissions.PICK_LISTS_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: UpdatePickListLineDTO): Promise<PickListLine> {
		await this.pickListLineService.update(id, entity as any);

		return await this.pickListLineService.findOneScoped(id);
	}

	/**
	 * Removes a line that was never visited.
	 *
	 * @param id The line.
	 * @returns Nothing.
	 */
	@ApiOperation({ summary: 'Remove a pick line' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The line was removed.' })
	@Permissions(WarehousePermissions.PICK_LISTS_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<void> {
		await this.pickListLineService.delete(id);
	}
}
