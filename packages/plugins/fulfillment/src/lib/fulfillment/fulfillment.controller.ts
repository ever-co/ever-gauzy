import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FulfillmentDirection, IPagination } from '@gauzy/contracts';
import {
	BaseQueryDTO,
	CrudController,
	Idempotent,
	Permissions,
	PermissionGuard,
	TenantPermissionGuard,
	UUIDValidationPipe,
	UseValidationPipe
} from '@gauzy/core';
import { Fulfillment } from './fulfillment.entity';
import { FulfillmentService } from './fulfillment.service';
import { FULFILLMENT_PERMISSIONS } from '../fulfillment.permissions';
import { CreateFulfillmentDTO, FulfillmentTransitionDTO, UpdateFulfillmentDTO } from './dto';

/**
 * The fulfilment resource, and the shipment's own transitions.
 *
 * The transitions live on this controller because they are what a shipment *is*: a status is not a field
 * a caller patches, it is the outcome of an event that has a precondition. `ship` may only follow
 * `PENDING`, `deliver` may only follow `SHIPPED` or `IN_TRANSIT`, and nothing may follow `DELIVERED` —
 * a delivered shipment is returned, not cancelled.
 *
 * Two of the routes below declare the platform's retry convention, and they are the two a client
 * retries after losing a response. Creating a fulfilment **demands** a key, because creating one twice
 * ships the same goods twice, and that is not a duplicate row but a duplicate parcel. Handing one to
 * the carrier honours a key when it is presented: a repeated `ship` is refused by the status machine
 * rather than by the key, so the key is offered rather than required, and a caller that never sends one
 * is unaffected.
 */
@ApiTags('Fulfillment')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(FULFILLMENT_PERMISSIONS.FULFILLMENTS_VIEW)
@Controller('/fulfillments')
export class FulfillmentController extends CrudController<Fulfillment> {
	constructor(private readonly fulfillmentService: FulfillmentService) {
		super(fulfillmentService);
	}

	/**
	 * Lists fulfilments.
	 *
	 * @param options The query options.
	 * @returns A page of fulfilments.
	 */
	@ApiOperation({ summary: 'List fulfillments' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Fulfillments found' })
	@Get()
	@UseValidationPipe()
	async findAll(@Query() options: BaseQueryDTO<Fulfillment>): Promise<IPagination<Fulfillment>> {
		return this.fulfillmentService.findAll(options);
	}

	/**
	 * Reads one fulfilment with its lines.
	 *
	 * @param id The fulfilment.
	 * @returns The fulfilment.
	 */
	@ApiOperation({ summary: 'Find a fulfillment by id' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Fulfillment found' })
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: string): Promise<Fulfillment> {
		return this.fulfillmentService.findOneByIdString(id, { relations: ['lines'] });
	}

	/**
	 * Creates a fulfilment for an order, partially or in full.
	 *
	 * @param entity The fulfilment and its lines.
	 * @returns The created fulfilment.
	 */
	@ApiOperation({ summary: 'Create a fulfillment' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Fulfillment created' })
	@Permissions(FULFILLMENT_PERMISSIONS.FULFILLMENTS_CREATE)
	@Idempotent({ scope: 'fulfillment.create', required: true, resourceType: 'fulfillment' })
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateFulfillmentDTO): Promise<Fulfillment> {
		return this.fulfillmentService.create(entity as any);
	}

	/**
	 * Updates a fulfilment's tracking details or note.
	 *
	 * @param id The fulfilment.
	 * @param entity The fields to change.
	 * @returns The fulfilment.
	 */
	@ApiOperation({ summary: 'Update a fulfillment' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Fulfillment updated' })
	@Permissions(FULFILLMENT_PERMISSIONS.FULFILLMENTS_EDIT)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: UpdateFulfillmentDTO
	): Promise<Fulfillment> {
		await this.fulfillmentService.update(id, entity as any);

		return this.fulfillmentService.findOneByIdString(id, { relations: ['lines'] });
	}

	/**
	 * Marks a fulfilment as handed to the carrier.
	 *
	 * @param id The fulfilment.
	 * @param body The tracking details.
	 * @returns The shipped fulfilment.
	 */
	@ApiOperation({ summary: 'Mark a fulfillment shipped' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Fulfillment shipped' })
	@Permissions(FULFILLMENT_PERMISSIONS.FULFILLMENTS_EDIT)
	@Idempotent({ scope: 'fulfillment.ship', required: false, resourceType: 'fulfillment' })
	@Post(':id/ship')
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ transform: true, whitelist: true })
	async ship(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() body: FulfillmentTransitionDTO
	): Promise<Fulfillment> {
		return this.fulfillmentService.ship(id, body ?? {});
	}

	/**
	 * Records that the carrier reported movement.
	 *
	 * @param id The fulfilment.
	 * @returns The updated fulfilment.
	 */
	@ApiOperation({ summary: 'Mark a fulfillment in transit' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Fulfillment in transit' })
	@Permissions(FULFILLMENT_PERMISSIONS.FULFILLMENTS_EDIT)
	@Post(':id/in-transit')
	@HttpCode(HttpStatus.OK)
	async markInTransit(@Param('id', UUIDValidationPipe) id: string): Promise<Fulfillment> {
		return this.fulfillmentService.markInTransit(id);
	}

	/**
	 * Marks a fulfilment as delivered.
	 *
	 * @param id The fulfilment.
	 * @param body The delivery instant, when the carrier supplied one.
	 * @returns The delivered fulfilment.
	 */
	@ApiOperation({ summary: 'Mark a fulfillment delivered' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Fulfillment delivered' })
	@Permissions(FULFILLMENT_PERMISSIONS.FULFILLMENTS_EDIT)
	@Post(':id/deliver')
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ transform: true, whitelist: true })
	async deliver(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() body: FulfillmentTransitionDTO
	): Promise<Fulfillment> {
		return this.fulfillmentService.deliver(id);
	}

	/**
	 * Cancels a fulfilment that has not been delivered.
	 *
	 * @param id The fulfilment.
	 * @param body The reason.
	 * @returns The cancelled fulfilment.
	 */
	@ApiOperation({ summary: 'Cancel a fulfillment' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Fulfillment cancelled' })
	@Permissions(FULFILLMENT_PERMISSIONS.FULFILLMENTS_EDIT)
	@Post(':id/cancel')
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ transform: true, whitelist: true })
	async cancel(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() body: FulfillmentTransitionDTO
	): Promise<Fulfillment> {
		return this.fulfillmentService.cancel(id, body?.reason);
	}

	/**
	 * The quantity of an order line that may still be shipped.
	 *
	 * @param orderLineId The order line.
	 * @returns The outstanding quantity, which is what a picking screen shows.
	 */
	@ApiOperation({ summary: 'Read what an order line still has to ship' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Outstanding quantity' })
	@Get('outstanding/:orderLineId')
	async outstanding(@Param('orderLineId', UUIDValidationPipe) orderLineId: string): Promise<{ orderLineId: string; outstanding: number }> {
		return { orderLineId, outstanding: await this.fulfillmentService.outstandingOf(orderLineId) };
	}

	/**
	 * Creates a return shipment for an order.
	 *
	 * A return is a fulfilment whose direction is `RETURN`: the goods move the other way, and everything
	 * else about a shipment — lines, carrier, tracking, lifecycle — is identical.
	 *
	 * @param entity The return shipment.
	 * @returns The created fulfilment.
	 */
	@ApiOperation({ summary: 'Create a return shipment' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Return shipment created' })
	@Permissions(FULFILLMENT_PERMISSIONS.FULFILLMENTS_CREATE)
	@Post('returns')
	@UseValidationPipe({ transform: true, whitelist: true })
	async createReturn(@Body() entity: CreateFulfillmentDTO): Promise<Fulfillment> {
		return this.fulfillmentService.create({
			...(entity as any),
			direction: FulfillmentDirection.RETURN
		});
	}
}
