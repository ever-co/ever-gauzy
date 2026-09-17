import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
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
import { IOrderReturnReceiptOutcome, IReturnShipmentResult } from '../returns.types';
import { ReturnsFeatures } from '../returns.features';
import { ReturnsPermissions } from '../returns.permissions';
import {
	CreateOrderReturnDTO,
	EditOrderReturnDTO,
	ReasonedOrderReturnActionDTO,
	ReceiveOrderReturnDTO,
	RefundOrderReturnDTO,
	ShipOrderReturnDTO
} from './dto';
import { OrderReturn } from './order-return.entity';
import { OrderReturnService } from './order-return.service';

/**
 * Returns.
 *
 * The CRUD surface a return shares with every other resource is inherited; what is declared here is
 * the lifecycle, because a return is not edited into its next state — it is approved, received and
 * closed, and each of those is an action with a permission of its own. A warehouse role holds
 * `RETURNS_RECEIVE` without holding `RETURNS_APPROVE`, and the routes are separate so that is
 * expressible.
 */
@ApiTags('OrderReturn')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(ReturnsFeatures.RETURNS)
@Permissions(ReturnsPermissions.RETURNS_VIEW)
@Controller('/order-returns')
export class OrderReturnController extends CrudController<OrderReturn> {
	constructor(private readonly orderReturnService: OrderReturnService) {
		super(orderReturnService);
	}

	/**
	 * Requests a return for an order.
	 *
	 * @param entity The return request.
	 * @returns The created return.
	 */
	@ApiOperation({ summary: 'Request a return for an order' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The return was requested.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'The request exceeds what was fulfilled.' })
	@Permissions(ReturnsPermissions.RETURNS_CREATE)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateOrderReturnDTO): Promise<OrderReturn> {
		return await this.orderReturnService.create(entity as any);
	}

	/**
	 * Updates a requested return, replacing its line set when one is supplied.
	 *
	 * @param id The return to update.
	 * @param entity The fields to change.
	 * @returns The updated return.
	 */
	@ApiOperation({ summary: 'Update a requested return' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The return was updated.' })
	@Permissions(ReturnsPermissions.RETURNS_CREATE)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: EditOrderReturnDTO): Promise<OrderReturn> {
		const { lines, ...changes } = entity;

		if (changes.warehouseId || changes.reason !== undefined || changes.note !== undefined) {
			await this.orderReturnService.update(id, changes as any);
		}

		if (lines?.length) {
			await this.orderReturnService.replaceLines(id, lines);
		}

		return await this.orderReturnService.findOneDetailed(id);
	}

	/**
	 * Approves a requested return.
	 *
	 * @param id The return to approve.
	 * @param entity An optional note.
	 * @returns The approved return.
	 */
	@ApiOperation({ summary: 'Approve a requested return' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The return was approved.' })
	@Permissions(ReturnsPermissions.RETURNS_APPROVE)
	@Post(':id/approve')
	@UseValidationPipe({ transform: true, whitelist: true })
	async approve(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: ReasonedOrderReturnActionDTO
	): Promise<OrderReturn> {
		return await this.orderReturnService.approve(id, entity.note);
	}

	/**
	 * Rejects a requested return.
	 *
	 * @param id The return to reject.
	 * @param entity Why it was rejected.
	 * @returns The rejected return.
	 */
	@ApiOperation({ summary: 'Reject a requested return' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The return was rejected.' })
	@Permissions(ReturnsPermissions.RETURNS_REJECT)
	@Post(':id/reject')
	@UseValidationPipe({ transform: true, whitelist: true })
	async reject(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: ReasonedOrderReturnActionDTO
	): Promise<OrderReturn> {
		return await this.orderReturnService.reject(id, entity.reason);
	}

	/**
	 * Receives returned goods: writes the stock movements and issues the refund.
	 *
	 * @param id The return being received.
	 * @param entity The quantities that arrived.
	 * @returns What the receipt did.
	 */
	@ApiOperation({ summary: 'Receive returned goods and trigger the refund' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The goods were received.' })
	@Permissions(ReturnsPermissions.RETURNS_RECEIVE)
	@Post(':id/receive')
	@UseValidationPipe({ transform: true, whitelist: true })
	async receive(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: ReceiveOrderReturnDTO
	): Promise<IOrderReturnReceiptOutcome> {
		return await this.orderReturnService.receive(id, entity.lines, {
			warehouseId: entity.warehouseId,
			refund: entity.refund,
			note: entity.note
		});
	}

	/**
	 * Refunds a received return.
	 *
	 * @param id The return being refunded.
	 * @param entity The amount and reason.
	 * @returns The refund that was written.
	 */
	@ApiOperation({ summary: 'Refund a received return' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The refund was issued.' })
	@Permissions(ReturnsPermissions.RETURNS_RECEIVE)
	@Post(':id/refund')
	@UseValidationPipe({ transform: true, whitelist: true })
	async refund(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: RefundOrderReturnDTO) {
		return await this.orderReturnService.refund(id, entity.amount, entity.reasonId, entity.note);
	}

	/**
	 * Creates the return leg: the shipment that brings the goods back.
	 *
	 * @param id The return to ship.
	 * @param entity The shipping option and tracking number.
	 * @returns What the shipping capability created.
	 */
	@ApiOperation({ summary: 'Create the return-direction fulfillment' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The return leg was created.' })
	@Permissions(ReturnsPermissions.RETURNS_CREATE)
	@Post(':id/shipping')
	@UseValidationPipe({ transform: true, whitelist: true })
	async shipping(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: ShipOrderReturnDTO
	): Promise<IReturnShipmentResult> {
		return await this.orderReturnService.createShipment(id, entity);
	}

	/**
	 * Cancels a return.
	 *
	 * @param id The return to cancel.
	 * @param entity Why it was cancelled.
	 * @returns The cancelled return.
	 */
	@ApiOperation({ summary: 'Cancel a return' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The return was cancelled.' })
	@Permissions(ReturnsPermissions.RETURNS_CREATE)
	@Post(':id/cancel')
	@UseValidationPipe({ transform: true, whitelist: true })
	async cancel(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: ReasonedOrderReturnActionDTO
	): Promise<OrderReturn> {
		return await this.orderReturnService.cancel(id, entity.reason);
	}

	/**
	 * Closes a fully received return.
	 *
	 * @param id The return to close.
	 * @returns The closed return.
	 */
	@ApiOperation({ summary: 'Close a fully received return' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The return was closed.' })
	@Permissions(ReturnsPermissions.RETURNS_RECEIVE)
	@Post(':id/close')
	async close(@Param('id', UUIDValidationPipe) id: ID): Promise<OrderReturn> {
		return await this.orderReturnService.close(id);
	}

	/**
	 * Reads a return with its lines, its reason and its receiving location.
	 *
	 * @param id The return to read.
	 * @returns The return.
	 */
	@ApiOperation({ summary: 'Find a return with its lines' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The return was found.' })
	@Permissions(ReturnsPermissions.RETURNS_VIEW)
	// The route the CRUD base maps for this method. An override replaces the inherited
	// method *and* its decorators, so the overriding controller restates it.
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<OrderReturn> {
		return await this.orderReturnService.findOneDetailed(id);
	}

	/**
	 * Lists returns.
	 *
	 * @param options The filter, including `filter[status]` and `filter[orderId]`.
	 * @returns The returns, paginated.
	 */
	@ApiOperation({ summary: 'List returns' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The returns were listed.' })
	@Permissions(ReturnsPermissions.RETURNS_VIEW)
	// The route the CRUD base maps for this method. An override replaces the inherited
	// method *and* its decorators, so the overriding controller restates it.
	@Get()
	async findAll(@Query() options: BaseQueryDTO<OrderReturn>): Promise<IPagination<OrderReturn>> {
		return await this.orderReturnService.findAll(options);
	}
}
