import {
	Body,
	Controller,
	Delete,
	Get,
	Headers,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	Query,
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
	UseValidationPipe
} from '@gauzy/core';
import { FeatureFlag } from '@gauzy/common';
import { parseIfMatch } from '../purchasing.http';
import { PurchasingFeatures } from '../purchasing.features';
import { PurchasingPermissions } from '../purchasing.permissions';
import { GoodsReceipt } from '../goods-receipt/goods-receipt.entity';
import { GoodsReceiptService } from '../goods-receipt/goods-receipt.service';
import {
	AcknowledgePurchaseOrderDTO,
	ApprovePurchaseOrderDTO,
	CancelPurchaseOrderDTO,
	ClosePurchaseOrderDTO,
	CreatePurchaseOrderDTO,
	EditPurchaseOrderDTO,
	ReceivePurchaseOrderDTO,
	SendPurchaseOrderDTO
} from './dto';
import { PurchaseOrder } from './purchase-order.entity';
import { PurchaseOrderService } from './purchase-order.service';

/**
 * Purchase orders.
 *
 * One surface, and it is the lifecycle rather than a set of field edits: an order is approved, sent,
 * acknowledged, cancelled or closed, and each of those is an action with a permission of its own and a
 * status it may be attempted from. The inherited CRUD routes are the draft's — an order that has left
 * `DRAFT` cannot be updated or deleted through them at all, which is what keeps a document the
 * supplier has been told about from being rewritten underneath them.
 *
 * Receiving is reachable from the order as well as from the receipt resource, because receiving is
 * what a caller looking at an order actually wants to do; both routes run the same service method and
 * therefore the same ceiling check.
 *
 * Raising an order honours the platform's retry key when one is presented. It is offered rather than
 * demanded: an order that is raised twice is refused by the numbering series and the supplier rules
 * rather than by a key, so a route that started demanding one would refuse every existing caller —
 * while a caller that does present one is answered, on a retry, with the order the first attempt
 * raised instead of with a second document for the same purchase.
 */
@ApiTags('PurchaseOrder')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(PurchasingFeatures.PURCHASING)
@Permissions(PurchasingPermissions.PURCHASE_ORDERS_VIEW)
@Controller('/purchase-orders')
export class PurchaseOrderController extends CrudController<PurchaseOrder> {
	constructor(
		private readonly purchaseOrderService: PurchaseOrderService,
		private readonly goodsReceiptService: GoodsReceiptService
	) {
		super(purchaseOrderService);
	}

	/**
	 * Raises a purchase order against an existing supplier.
	 *
	 * @param entity The order to raise.
	 * @returns The created order.
	 */
	@ApiOperation({ summary: 'Raise a purchase order against an existing supplier' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The purchase order was raised.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'The supplier does not exist.' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'The supplier is archived or inactive.' })
	@Permissions(PurchasingPermissions.PURCHASE_ORDERS_CREATE)
	@Idempotent({ scope: 'purchase_order.create', required: false, resourceType: 'purchase_order' })
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreatePurchaseOrderDTO): Promise<PurchaseOrder> {
		return await this.purchaseOrderService.create(entity as any);
	}

	/**
	 * Amends a draft purchase order, replacing its line set when one is supplied.
	 *
	 * @param id The order to amend.
	 * @param entity The fields to change.
	 * @param ifMatch The version the caller read, when it stated one.
	 * @returns The amended order.
	 */
	@ApiOperation({ summary: 'Amend a draft purchase order' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The purchase order was amended.' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'The order has left DRAFT, or moved on since the stated version.' })
	@Permissions(PurchasingPermissions.PURCHASE_ORDERS_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: EditPurchaseOrderDTO,
		@Headers('if-match') ifMatch?: string
	): Promise<PurchaseOrder> {
		return await this.purchaseOrderService.update(id, {
			...entity,
			version: parseIfMatch(ifMatch)
		} as any);
	}

	/**
	 * Deletes a draft purchase order.
	 *
	 * @param id The order to delete.
	 * @returns The deletion result.
	 */
	@ApiOperation({ summary: 'Delete a draft purchase order' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The purchase order was deleted.' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'The order has left DRAFT.' })
	@Permissions(PurchasingPermissions.PURCHASE_ORDERS_EDIT)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<any> {
		return super.delete(id);
	}

	/**
	 * Sends an approved purchase order to the supplier.
	 *
	 * @param id The order to send.
	 * @param entity The recipient override and an operator note.
	 * @param ifMatch The version the caller read, when it stated one.
	 * @returns The sent order.
	 */
	@ApiOperation({ summary: 'Send an approved purchase order to the supplier' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The purchase order was sent.' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'The order is not a draft, or has not been approved.' })
	@Permissions(PurchasingPermissions.PURCHASE_ORDERS_SEND)
	@Post(':id/send')
	@UseValidationPipe({ transform: true, whitelist: true })
	async send(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: SendPurchaseOrderDTO,
		@Headers('if-match') ifMatch?: string
	): Promise<PurchaseOrder> {
		return await this.purchaseOrderService.send(id, {
			email: entity.email,
			note: entity.note,
			expectedVersion: parseIfMatch(ifMatch)
		});
	}

	/**
	 * Records the supplier's acknowledgement of a sent order.
	 *
	 * @param id The order being acknowledged.
	 * @param entity The revised expected date and an operator note.
	 * @param ifMatch The version the caller read, when it stated one.
	 * @returns The acknowledged order.
	 */
	@ApiOperation({ summary: 'Record the supplier acknowledgement of a purchase order' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The purchase order was acknowledged.' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'The order is not SENT.' })
	@Permissions(PurchasingPermissions.PURCHASE_ORDERS_EDIT)
	@Post(':id/acknowledge')
	@UseValidationPipe({ transform: true, whitelist: true })
	async acknowledge(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: AcknowledgePurchaseOrderDTO,
		@Headers('if-match') ifMatch?: string
	): Promise<PurchaseOrder> {
		return await this.purchaseOrderService.acknowledge(id, {
			expectedAt: entity.expectedAt,
			note: entity.note,
			expectedVersion: parseIfMatch(ifMatch)
		});
	}

	/**
	 * Approves a purchase order internally.
	 *
	 * @param id The order to approve.
	 * @param entity An optional note.
	 * @returns The approved order.
	 */
	@ApiOperation({ summary: 'Approve a purchase order internally' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The purchase order was approved.' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'The order is not a draft.' })
	@Permissions(PurchasingPermissions.PURCHASE_ORDERS_APPROVE)
	@Post(':id/approve')
	@UseValidationPipe({ transform: true, whitelist: true })
	async approve(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: ApprovePurchaseOrderDTO,
		@Headers('if-match') ifMatch?: string
	): Promise<PurchaseOrder> {
		return await this.purchaseOrderService.approve(id, entity.note, parseIfMatch(ifMatch));
	}

	/**
	 * Cancels a purchase order before anything arrived.
	 *
	 * @param id The order to cancel.
	 * @param entity Why it was cancelled.
	 * @returns The cancelled order.
	 */
	@ApiOperation({ summary: 'Cancel a purchase order before receipt' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The purchase order was cancelled.' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'The order is neither a draft nor sent.' })
	@Permissions(PurchasingPermissions.PURCHASE_ORDERS_EDIT)
	@Post(':id/cancel')
	@UseValidationPipe({ transform: true, whitelist: true })
	async cancel(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: CancelPurchaseOrderDTO,
		@Headers('if-match') ifMatch?: string
	): Promise<PurchaseOrder> {
		return await this.purchaseOrderService.cancel(id, entity.reason, parseIfMatch(ifMatch));
	}

	/**
	 * Closes a purchase order short of the ordered quantity.
	 *
	 * @param id The order to close.
	 * @param entity Why it was closed short.
	 * @returns The closed order.
	 */
	@ApiOperation({ summary: 'Close a purchase order short of the ordered quantity' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The purchase order was closed.' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'The order cannot be closed from its status.' })
	@Permissions(PurchasingPermissions.PURCHASE_ORDERS_EDIT)
	@Post(':id/close')
	@UseValidationPipe({ transform: true, whitelist: true })
	async close(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: ClosePurchaseOrderDTO,
		@Headers('if-match') ifMatch?: string
	): Promise<PurchaseOrder> {
		return await this.purchaseOrderService.close(id, entity.reason, parseIfMatch(ifMatch));
	}

	/**
	 * Receives goods against this purchase order.
	 *
	 * **The retry key is required**, under `purchase_order.receive` — the scope `POST /goods-receipts`
	 * books the same delivery under. Both routes reach `GoodsReceiptService.receive`, which posts a new
	 * receipt, writes inbound movements and advances the received counters on every call: a partial
	 * delivery re-sent after a timeout is booked twice and nothing refuses the second, because it is still
	 * inside the ordered quantity. A route that booked it without a key while its sibling demanded one
	 * would be the keyless way round the rule, so a request without `Idempotency-Key` is refused here too,
	 * and a retried one is answered with the receipt its first attempt booked.
	 *
	 * @param id The order being received against.
	 * @param entity The quantities that arrived.
	 * @param ifMatch The order version the caller read, when it stated one.
	 * @returns The receipt, carrying the movements it wrote and the order's new state.
	 */
	@ApiOperation({ summary: 'Receive goods against a purchase order' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The goods were received.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'The request carried no Idempotency-Key.' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'The order cannot be received, or a line exceeds the ordered quantity.' })
	@Permissions(PurchasingPermissions.GOODS_RECEIPTS_CREATE)
	@Idempotent({ scope: 'purchase_order.receive', required: true, resourceType: 'goods_receipt' })
	@HttpCode(HttpStatus.CREATED)
	@Post(':id/receipts')
	@UseValidationPipe({ transform: true, whitelist: true })
	async receive(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: ReceivePurchaseOrderDTO,
		@Headers('if-match') ifMatch?: string
	): Promise<GoodsReceipt> {
		return await this.goodsReceiptService.receive({
			purchaseOrderId: id,
			receivedAt: entity.receivedAt,
			overReceiptTolerance: entity.overReceiptTolerance,
			expectedVersion: parseIfMatch(ifMatch),
			note: entity.note,
			lines: entity.lines
		} as any);
	}

	/**
	 * Reads a purchase order with its lines, its receipts and its supplier.
	 *
	 * @param id The order to read.
	 * @returns The order.
	 */
	@ApiOperation({ summary: 'Find a purchase order with its lines, receipts and supplier' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The purchase order was found.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'The purchase order does not exist.' })
	@Permissions(PurchasingPermissions.PURCHASE_ORDERS_VIEW)
	// The route the CRUD base maps for this method. An override replaces the inherited method *and*
	// its decorators, so the overriding controller restates it — without this line the detail
	// endpoint would simply not exist.
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<PurchaseOrder> {
		return await this.purchaseOrderService.findOneDetailed(id);
	}

	/**
	 * Lists purchase orders.
	 *
	 * @param options The filter, including `filter[status]`, `filter[vendorId]`, `filter[warehouseId]`
	 * and `filter[expectedAt]`.
	 * @returns The orders, paginated.
	 */
	@ApiOperation({ summary: 'List purchase orders' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The purchase orders were listed.' })
	@Permissions(PurchasingPermissions.PURCHASE_ORDERS_VIEW)
	// The route the CRUD base maps for this method, restated for the same reason as `findById` above.
	@Get()
	async findAll(@Query() options: BaseQueryDTO<PurchaseOrder>): Promise<IPagination<PurchaseOrder>> {
		return await this.purchaseOrderService.findAll(options);
	}

	/**
	 * Soft deletes a purchase order.
	 *
	 * The `DELETE ':id/soft'` route belongs to `CrudController`, and this override exists only to state
	 * the permission it demands. The base declares the route with no permission metadata of its own, so
	 * `PermissionGuard` resolves the metadata handler-first-then-class — `getAllAndOverride` over
	 * `PERMISSIONS_METADATA` in `packages/core/src/lib/shared/guards/permission.guard.ts` — and answers
	 * `true` to empty metadata with its `isEmpty(permissions)` return, which left the inherited route
	 * demanding only this controller's class-level view grant. It now states `PURCHASE_ORDERS_EDIT`, the
	 * grant the plugin's `deletePurchaseOrder` mutation carries, which is the route this one mirrors.
	 *
	 * @param id The order to soft delete.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The soft-deleted order.
	 */
	@ApiOperation({ summary: 'Soft delete a record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record soft deleted successfully' })
	@Permissions(PurchasingPermissions.PURCHASE_ORDERS_EDIT)
	@Delete(':id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<any> {
		// The base hands this same array over; the service's signature names find options, hence the cast.
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a soft-deleted purchase order.
	 *
	 * The `PUT ':id/recover'` route belongs to `CrudController`, and this override exists only to state
	 * the permission it demands. The base declares the route with no permission metadata of its own, so
	 * `PermissionGuard` resolves the metadata handler-first-then-class — `getAllAndOverride` over
	 * `PERMISSIONS_METADATA` in `packages/core/src/lib/shared/guards/permission.guard.ts` — and answers
	 * `true` to empty metadata with its `isEmpty(permissions)` return, which left the inherited route
	 * demanding only this controller's class-level view grant. It now states `PURCHASE_ORDERS_EDIT`, the
	 * grant the plugin's `deletePurchaseOrder` mutation carries, which is the route this one mirrors.
	 *
	 * @param id The order to restore.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The restored order.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record restored successfully' })
	@Permissions(PurchasingPermissions.PURCHASE_ORDERS_EDIT)
	@Put(':id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<any> {
		// The base hands this same array over; the service's signature names find options, hence the cast.
		return await super.softRecover(id, ...options);
	}
}
