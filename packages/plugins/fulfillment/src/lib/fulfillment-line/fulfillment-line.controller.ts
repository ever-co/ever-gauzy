import { Body, Controller, HttpCode, HttpStatus, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
	CrudController,
	Permissions,
	PermissionGuard,
	TenantPermissionGuard,
	UseValidationPipe,
	UUIDValidationPipe
} from '@gauzy/core';
import { FulfillmentLine } from './fulfillment-line.entity';
import { FulfillmentLineService } from './fulfillment-line.service';
import { CreateFulfillmentLineDTO, UpdateFulfillmentLineDTO } from './dto';
import { FULFILLMENT_PERMISSIONS } from '../fulfillment.permissions';

/**
 * The FulfillmentLine resource.
 *
 * One controller per entity, on the entity's own concept path, with the same guards and permissions the
 * rest of the platform uses. There is no second surface and no parallel controller for this resource.
 *
 * A line is normally written as part of its fulfilment, which is why the two write routes below carry
 * the fulfilment grants: they are the repair surface for a line recorded on its own, and they are
 * declared rather than inherited because a body is validated from the type the handler names — the
 * base class names the entity's shape as a generic, whose reflected type is `Object`, and a parameter
 * the validation pipe cannot name a class for is skipped, so an inherited route accepts any body at
 * all and writes it.
 */
@ApiTags('FulfillmentLine')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(FULFILLMENT_PERMISSIONS.FULFILLMENTS_VIEW)
@Controller('/fulfillment-lines')
export class FulfillmentLineController extends CrudController<FulfillmentLine> {
	constructor(private readonly service: FulfillmentLineService) {
		super(service);
	}

	/**
	 * Writes one line against a fulfilment.
	 *
	 * @param entity The line to write.
	 * @returns The created line.
	 */
	@ApiOperation({ summary: 'Create a fulfillment line' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Fulfillment line created' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid line input' })
	@Permissions(FULFILLMENT_PERMISSIONS.FULFILLMENTS_CREATE)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateFulfillmentLineDTO): Promise<FulfillmentLine> {
		return this.service.create(entity as any);
	}

	/**
	 * Corrects one line.
	 *
	 * @param id The line.
	 * @param entity The fields to change.
	 * @returns The result of the update.
	 */
	@ApiOperation({ summary: 'Update a fulfillment line' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Fulfillment line updated' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Fulfillment line not found' })
	@Permissions(FULFILLMENT_PERMISSIONS.FULFILLMENTS_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(@Param('id', UUIDValidationPipe) id: string, @Body() entity: UpdateFulfillmentLineDTO) {
		return this.service.update(id, entity as any);
	}
}