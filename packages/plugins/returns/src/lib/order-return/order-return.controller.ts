import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	Query,
	Req,
	UseGuards,
	UsePipes
} from '@nestjs/common';
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
	Versioned,
	versionExpectationOf
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
 *
 * Two conventions are declared on the routes below, and neither is a property of the handler.
 *
 * **Retry safety.** Requesting a return and receiving one are the two operations a client retries
 * after losing a response, and receiving one twice restocks the goods and refunds the money twice.
 * The receiving route therefore demands an `Idempotency-Key` header, and the requesting route honours
 * one when it is presented.
 *
 * **Optimistic concurrency.** A return is a versioned aggregate: every write of its header — a
 * transition, a receipt, a refund, an edit — is predicated on the version the caller read, which it
 * states in an `If-Match` header and reads back from the `ETag` of every response. The one exception
 * is the request that creates a return: there is no earlier version of a row that does not exist yet,
 * so the header is optional there and is checked when it is sent.
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
	@Idempotent({ scope: 'return.create', required: false, resourceType: 'order_return' })
	@Versioned({ resource: OrderReturnService, required: false })
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
	 * @param request The request the guard left the accepted version on.
	 * @returns The updated return.
	 */
	@ApiOperation({ summary: 'Update a requested return' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The return was updated.' })
	@Permissions(ReturnsPermissions.RETURNS_CREATE)
	@Versioned({ resource: OrderReturnService })
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: EditOrderReturnDTO,
		@Req() request: any
	): Promise<OrderReturn> {
		const { lines, ...changes } = entity;
		const changed = Boolean(changes.warehouseId) || changes.reason !== undefined || changes.note !== undefined;

		if (changed || lines?.length) {
			// The header is committed either way: a rewrite of the line set is a change of the aggregate
			// even when no field of the header moved, and the version has to follow it.
			await this.orderReturnService.applyVersionedUpdate(
				id,
				changed ? (changes as any) : {},
				versionExpectationOf(request)
			);
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
	 * @param request The request the guard left the accepted version on.
	 * @returns The approved return.
	 */
	@ApiOperation({ summary: 'Approve a requested return' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The return was approved.' })
	@Permissions(ReturnsPermissions.RETURNS_APPROVE)
	@Versioned({ resource: OrderReturnService })
	@Post(':id/approve')
	@UseValidationPipe({ transform: true, whitelist: true })
	async approve(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: ReasonedOrderReturnActionDTO,
		@Req() request: any
	): Promise<OrderReturn> {
		return await this.orderReturnService.approve(id, entity.note, versionExpectationOf(request));
	}

	/**
	 * Rejects a requested return.
	 *
	 * @param id The return to reject.
	 * @param entity Why it was rejected.
	 * @param request The request the guard left the accepted version on.
	 * @returns The rejected return.
	 */
	@ApiOperation({ summary: 'Reject a requested return' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The return was rejected.' })
	@Permissions(ReturnsPermissions.RETURNS_REJECT)
	@Versioned({ resource: OrderReturnService })
	@Post(':id/reject')
	@UseValidationPipe({ transform: true, whitelist: true })
	async reject(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: ReasonedOrderReturnActionDTO,
		@Req() request: any
	): Promise<OrderReturn> {
		return await this.orderReturnService.reject(id, entity.reason, versionExpectationOf(request));
	}

	/**
	 * Receives returned goods: writes the stock movements and issues the refund.
	 *
	 * @param id The return being received.
	 * @param entity The quantities that arrived.
	 * @param request The request the guard left the accepted version on.
	 * @returns What the receipt did.
	 */
	@ApiOperation({ summary: 'Receive returned goods and trigger the refund' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The goods were received.' })
	@Permissions(ReturnsPermissions.RETURNS_RECEIVE)
	@Idempotent({ scope: 'return.receive', required: true, resourceType: 'order_return' })
	@Versioned({ resource: OrderReturnService })
	@Post(':id/receive')
	@UseValidationPipe({ transform: true, whitelist: true })
	async receive(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: ReceiveOrderReturnDTO,
		@Req() request: any
	): Promise<IOrderReturnReceiptOutcome> {
		return await this.orderReturnService.receive(
			id,
			entity.lines,
			{
				warehouseId: entity.warehouseId,
				refund: entity.refund,
				note: entity.note
			},
			versionExpectationOf(request)
		);
	}

	/**
	 * Refunds a received return.
	 *
	 * @param id The return being refunded.
	 * @param entity The amount and reason.
	 * @param request The request the guard left the accepted version on.
	 * @returns The refund that was written.
	 */
	@ApiOperation({ summary: 'Refund a received return' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The refund was issued.' })
	@Permissions(ReturnsPermissions.RETURNS_RECEIVE)
	@Versioned({ resource: OrderReturnService })
	@Post(':id/refund')
	@UseValidationPipe({ transform: true, whitelist: true })
	async refund(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: RefundOrderReturnDTO,
		@Req() request: any
	) {
		return await this.orderReturnService.refund(
			id,
			entity.amount,
			entity.reasonId,
			entity.note,
			versionExpectationOf(request)
		);
	}

	/**
	 * Creates the return leg: the shipment that brings the goods back.
	 *
	 * @param id The return to ship.
	 * @param entity The shipping option and tracking number.
	 * @param request The request the guard left the accepted version on.
	 * @returns What the shipping capability created.
	 */
	@ApiOperation({ summary: 'Create the return-direction fulfillment' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The return leg was created.' })
	@Permissions(ReturnsPermissions.RETURNS_CREATE)
	@Versioned({ resource: OrderReturnService })
	@Post(':id/shipping')
	@UseValidationPipe({ transform: true, whitelist: true })
	async shipping(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: ShipOrderReturnDTO,
		@Req() request: any
	): Promise<IReturnShipmentResult> {
		return await this.orderReturnService.createShipment(id, entity, versionExpectationOf(request));
	}

	/**
	 * Cancels a return.
	 *
	 * @param id The return to cancel.
	 * @param entity Why it was cancelled.
	 * @param request The request the guard left the accepted version on.
	 * @returns The cancelled return.
	 */
	@ApiOperation({ summary: 'Cancel a return' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The return was cancelled.' })
	@Permissions(ReturnsPermissions.RETURNS_CREATE)
	@Versioned({ resource: OrderReturnService })
	@Post(':id/cancel')
	@UseValidationPipe({ transform: true, whitelist: true })
	async cancel(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: ReasonedOrderReturnActionDTO,
		@Req() request: any
	): Promise<OrderReturn> {
		return await this.orderReturnService.cancel(id, entity.reason, versionExpectationOf(request));
	}

	/**
	 * Closes a fully received return.
	 *
	 * @param id The return to close.
	 * @param request The request the guard left the accepted version on.
	 * @returns The closed return.
	 */
	@ApiOperation({ summary: 'Close a fully received return' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The return was closed.' })
	@Permissions(ReturnsPermissions.RETURNS_RECEIVE)
	@Versioned({ resource: OrderReturnService })
	@Post(':id/close')
	async close(@Param('id', UUIDValidationPipe) id: ID, @Req() request: any): Promise<OrderReturn> {
		return await this.orderReturnService.close(id, versionExpectationOf(request));
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
	@Versioned({ resource: OrderReturnService, write: false })
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

	/**
	 * Deletes a return.
	 *
	 * The route belongs to `CrudController`, and this override exists only to state its permission:
	 * the base declares `DELETE :id` with no permission metadata at all, and `PermissionGuard`
	 * (`packages/core/src/lib/shared/guards/permission.guard.ts`) returns `true` to empty metadata —
	 * `if (isEmpty(permissions)) { return true; }` — so the inherited handler stands on the
	 * class-level read grant alone. The plugin declares no `RETURNS_DELETE`, so this states
	 * `RETURNS_CREATE`, the grant that already lets a caller write a return.
	 *
	 * @param id The return to delete.
	 * @returns The result of the delete.
	 */
	@ApiOperation({ summary: 'Delete a return' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The return was deleted.' })
	@Permissions(ReturnsPermissions.RETURNS_CREATE)
	@Delete(':id')
	@HttpCode(HttpStatus.ACCEPTED)
	async delete(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return super.delete(id);
	}

	/**
	 * Soft-deletes a return.
	 *
	 * The route belongs to `CrudController`, and this override exists only to state its permission:
	 * the base declares `DELETE :id/soft` with no permission metadata at all, and `PermissionGuard`
	 * (`packages/core/src/lib/shared/guards/permission.guard.ts`) returns `true` to empty metadata —
	 * `if (isEmpty(permissions)) { return true; }` — so the inherited handler stands on the
	 * class-level read grant alone. Soft removal is the same destructive write staged for recovery,
	 * so it states `RETURNS_CREATE` as well.
	 *
	 * @param id The return to soft delete.
	 * @returns The soft-deleted return.
	 */
	@ApiOperation({ summary: 'Soft delete a return' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The return was soft deleted.' })
	@Permissions(ReturnsPermissions.RETURNS_CREATE)
	@Delete(':id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a soft-deleted return.
	 *
	 * The route belongs to `CrudController`, and this override exists only to state its permission:
	 * the base declares `PUT :id/recover` with no permission metadata at all, and `PermissionGuard`
	 * (`packages/core/src/lib/shared/guards/permission.guard.ts`) returns `true` to empty metadata —
	 * `if (isEmpty(permissions)) { return true; }` — so the inherited handler stands on the
	 * class-level read grant alone. Restoring is the same destructive grant exercised backwards, so
	 * it states `RETURNS_CREATE` as well.
	 *
	 * @param id The return to restore.
	 * @returns The restored return.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted return' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The return was restored.' })
	@Permissions(ReturnsPermissions.RETURNS_CREATE)
	@Put(':id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRecover(id, ...options);
	}
}
