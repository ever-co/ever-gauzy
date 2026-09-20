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
import { Request } from 'express';
import { IPagination, IOrder, OrderChangeType } from '@gauzy/contracts';
import {
	AbstractValidationPipe,
	BaseQueryDTO,
	CrudController,
	Idempotent,
	Permissions,
	PermissionGuard,
	TenantOrganizationBaseDTO,
	TenantPermissionGuard,
	UUIDValidationPipe,
	UseValidationPipe,
	Versioned,
	versionExpectationOf
} from '@gauzy/core';
import { Order } from './order.entity';
import { OrderService } from './order.service';
import { ORDER_PERMISSIONS } from '../order.permissions';
import { CreateOrderDTO, UpdateOrderDTO } from './dto';
import { OrderChangeService } from '../order-change/order-change.service';
import { OrderCreditLineService } from '../order-credit-line/order-credit-line.service';
import { OrderHistoryService } from '../order-history/order-history.service';
import { OrderSummaryService } from '../order-summary/order-summary.service';
import { OrderTotalsService } from '../order-totals/order-totals.service';
import { OrderTransactionService } from '../order-transaction/order-transaction.service';
import { CreateOrderChangeDTO } from '../order-change/dto';
import { CreateOrderCreditLineDTO } from '../order-credit-line/dto';

/**
 * The order resource.
 *
 * There is one API surface: a staff caller and a buyer hit the same routes, and what each may do is
 * decided by the guard and the permission, never by a second base path. The routes that move an order
 * forward — placing it, cancelling it, archiving it, and working a change through to application — live
 * here rather than on a second controller, because that is what "one controller per entity" means.
 *
 * Two conventions are adopted on the mutating routes and are deliberately identical on the GraphQL
 * mutations that mirror them:
 *
 * - `@Idempotent(...)` makes a route safe to retry under a client-supplied key. Confirming a change
 *   requires one, because a lost response to it costs a second application of the same change; the
 *   remaining writes honour a key when one is presented and behave as they always did when none is.
 * - `@Versioned({ resource: OrderService })` refuses a write based on an order that has moved on and
 *   publishes the order's version as an `ETag`, which is the header the next write states back. The
 *   version is always the **order's**, including on the routes that write a change: a change is part of
 *   the aggregate the order's version describes, and its own `version` column means something else —
 *   the order version the change produces. A route whose path names only the change states no resource,
 *   because the order it belongs to is resolved by the handler.
 */
@ApiTags('Order')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(ORDER_PERMISSIONS.ORDERS_VIEW)
@Controller('/orders')
export class OrderController extends CrudController<Order> {
	constructor(
		private readonly orderService: OrderService,
		private readonly totalsService: OrderTotalsService,
		private readonly changeService: OrderChangeService,
		private readonly creditLineService: OrderCreditLineService,
		private readonly transactionService: OrderTransactionService,
		private readonly summaryService: OrderSummaryService,
		private readonly historyService: OrderHistoryService
	) {
		super(orderService);
	}

	/**
	 * Creates a draft order.
	 *
	 * No version is required of the caller — there is no order to have read yet — and the created
	 * order's version is published in the response for the writes that follow.
	 *
	 * @param entity The order to create.
	 * @returns The created order.
	 */
	@ApiOperation({ summary: 'Create a draft order' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Order created' })
	@Permissions(ORDER_PERMISSIONS.ORDERS_CREATE)
	@Idempotent({ scope: 'order.create', required: false, resourceType: 'order' })
	@Versioned({ resource: OrderService, required: false })
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateOrderDTO): Promise<IOrder> {
		return this.orderService.create(entity as any);
	}

	/**
	 * Reads an order with the satellites a caller needs to render it.
	 *
	 * The response carries the order's version as an `ETag` and in the body, which is what a caller
	 * states back as `If-Match` on the write it is about to make.
	 *
	 * @param id The order.
	 * @returns The order.
	 */
	@ApiOperation({ summary: 'Find an order by id' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Order found' })
	@Versioned({ resource: OrderService, write: false })
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: string): Promise<IOrder> {
		return this.orderService.findOneByIdString(id, {
			relations: ['lines', 'addresses', 'shippingMethods', 'transactions', 'changes', 'history']
		});
	}

	/**
	 * Looks an order up by its human number.
	 *
	 * @param number The order number.
	 * @returns The order.
	 */
	@ApiOperation({ summary: 'Find an order by its number' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Order found' })
	@Get('by-number/:number')
	async findByNumber(@Param('number') number: string): Promise<IOrder> {
		return this.orderService.findOneByWhereOptions({ number } as any);
	}

	/**
	 * Updates the few fields of an order that may change outside a change.
	 *
	 * @param id The order.
	 * @param entity The fields to change.
	 * @param request The request, which carries the version the caller read the order at.
	 * @returns The order.
	 */
	@ApiOperation({ summary: 'Update an order' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Order updated' })
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Versioned({ resource: OrderService })
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: UpdateOrderDTO,
		@Req() request: Request
	): Promise<IOrder> {
		return this.orderService.updateMutable(id, entity as any, versionExpectationOf(request));
	}

	/**
	 * Places a draft order.
	 *
	 * @param id The order.
	 * @param request The request, which carries the version the caller read the order at.
	 * @returns The placed order.
	 */
	@ApiOperation({ summary: 'Place a draft order' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Order placed' })
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Idempotent({ scope: 'order.place', required: false, resourceType: 'order' })
	@Versioned({ resource: OrderService })
	@Post(':id/place')
	@HttpCode(HttpStatus.OK)
	async place(@Param('id', UUIDValidationPipe) id: string, @Req() request: Request): Promise<IOrder> {
		return this.orderService.place(id, {}, versionExpectationOf(request));
	}

	/**
	 * Confirms a placed order.
	 *
	 * @param id The order.
	 * @param request The request, which carries the version the caller read the order at.
	 * @returns The confirmed order.
	 */
	@ApiOperation({ summary: 'Confirm a placed order' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Order confirmed' })
	@Permissions(ORDER_PERMISSIONS.ORDERS_APPROVE)
	@Versioned({ resource: OrderService })
	@Post(':id/approve')
	@HttpCode(HttpStatus.OK)
	async approve(@Param('id', UUIDValidationPipe) id: string, @Req() request: Request): Promise<IOrder> {
		return this.orderService.confirm(id, 'STAFF', versionExpectationOf(request));
	}

	/**
	 * Cancels an order that nothing has shipped from.
	 *
	 * @param id The order.
	 * @param body The reason.
	 * @param request The request, which carries the version the caller read the order at.
	 * @returns The cancelled order.
	 */
	@ApiOperation({ summary: 'Cancel an order' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Order cancelled' })
	@Permissions(ORDER_PERMISSIONS.ORDERS_CANCEL)
	@Idempotent({ scope: 'order.cancel', required: false, resourceType: 'order' })
	@Versioned({ resource: OrderService })
	@Post(':id/cancel')
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ transform: true, whitelist: true })
	async cancel(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() body: { reason?: string },
		@Req() request: Request
	): Promise<IOrder> {
		return this.orderService.cancel(id, body?.reason, versionExpectationOf(request));
	}

	/**
	 * Archives a terminal order.
	 *
	 * @param id The order.
	 * @param request The request, which carries the version the caller read the order at.
	 * @returns The archived order.
	 */
	@ApiOperation({ summary: 'Archive an order' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Order archived' })
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Versioned({ resource: OrderService })
	@Post(':id/archive')
	@HttpCode(HttpStatus.OK)
	async archive(@Param('id', UUIDValidationPipe) id: string, @Req() request: Request): Promise<IOrder> {
		return this.orderService.archive(id, versionExpectationOf(request));
	}

	/**
	 * Recomputes an order's totals from its lines and the money ledgers.
	 *
	 * @param id The order.
	 * @param request The request, which carries the version the caller read the order at.
	 * @returns The order with its recomputed totals.
	 */
	@ApiOperation({ summary: 'Recalculate an order' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Order recalculated' })
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Versioned({ resource: OrderService })
	@Post(':id/recalculate')
	@HttpCode(HttpStatus.OK)
	async recalculate(@Param('id', UUIDValidationPipe) id: string, @Req() request: Request): Promise<IOrder> {
		return this.totalsService.recompute(id, 'MANUAL', { expectation: versionExpectationOf(request) });
	}

	/**
	 * The totals of every committed version, so "what did this total at version 3, and why?" is
	 * answerable.
	 *
	 * @param id The order.
	 * @returns The summary rows, newest first.
	 */
	@ApiOperation({ summary: 'Read the totals history of an order' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Summaries found' })
	@Get(':id/summaries')
	async summaries(@Param('id', UUIDValidationPipe) id: string): Promise<IPagination<any>> {
		const page = await this.summaryService.findAll({ where: { orderId: id } });

		return {
			...page,
			items: [...page.items].sort((left, right) => Number(right.version) - Number(left.version))
		};
	}

	/**
	 * The order's timeline.
	 *
	 * @param id The order.
	 * @returns The timeline entries.
	 */
	@ApiOperation({ summary: 'Read the timeline of an order' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Timeline found' })
	@Get(':id/history')
	async history(@Param('id', UUIDValidationPipe) id: string) {
		return this.historyService.timeline(id);
	}

	/**
	 * The order's money ledger.
	 *
	 * @param id The order.
	 * @returns The transactions.
	 */
	@ApiOperation({ summary: 'Read the money ledger of an order' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Transactions found' })
	@Get(':id/transactions')
	async transactions(@Param('id', UUIDValidationPipe) id: string): Promise<IPagination<any>> {
		return this.transactionService.findAll({ where: { orderId: id } });
	}

	/**
	 * The credit lines applied to an order.
	 *
	 * @param id The order.
	 * @returns The credit lines.
	 */
	@ApiOperation({ summary: 'Read the credit lines of an order' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Credit lines found' })
	@Get(':id/credit-lines')
	async creditLines(@Param('id', UUIDValidationPipe) id: string): Promise<IPagination<any>> {
		return this.creditLineService.findAll({ where: { orderId: id } });
	}

	/**
	 * Applies a credit line, which reduces what the customer owes without money moving.
	 *
	 * The route creates a change rather than writing the order, so the version the caller states is the
	 * order version the credit was reasoned about: an order that has moved on since is refused before
	 * anything is recorded.
	 *
	 * @param id The order.
	 * @param entity The credit to apply.
	 * @returns The change that carries the credit.
	 */
	@ApiOperation({ summary: 'Apply a credit line to an order' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Credit line applied' })
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Versioned({ resource: OrderService })
	@Post(':id/credit-lines')
	@UseValidationPipe({ transform: true, whitelist: true })
	async addCreditLine(@Param('id', UUIDValidationPipe) id: string, @Body() entity: CreateOrderCreditLineDTO) {
		return this.changeService.create({
			orderId: id,
			changeType: OrderChangeType.CREDIT,
			actions: [
				{
					action: 'CREDIT_LINE_ADD' as any,
					amount: entity.amount,
					details: {
						amount: entity.amount,
						description: entity.description,
						referenceType: entity.referenceType,
						referenceId: entity.referenceId
					}
				}
			]
		} as any);
	}

	/**
	 * Creates a change: the only way a placed order is modified.
	 *
	 * @param id The order.
	 * @param entity The change and its actions.
	 * @returns The created change.
	 */
	@ApiOperation({ summary: 'Create a change on an order' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Change created' })
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Idempotent({ scope: 'order.change.create', required: false, resourceType: 'order_change' })
	@Versioned({ resource: OrderService })
	@Post(':id/changes')
	@UseValidationPipe({ transform: true, whitelist: true })
	async createChange(@Param('id', UUIDValidationPipe) id: string, @Body() entity: CreateOrderChangeDTO) {
		return this.changeService.create({ ...(entity as any), orderId: id });
	}

	/**
	 * The changes of an order.
	 *
	 * @param id The order.
	 * @returns The changes.
	 */
	@ApiOperation({ summary: 'Read the changes of an order' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Changes found' })
	@Get(':id/changes')
	async changes(@Param('id', UUIDValidationPipe) id: string): Promise<IPagination<any>> {
		return this.changeService.findAll({ where: { orderId: id }, relations: ['actions'] });
	}

	/**
	 * Applies a change.
	 *
	 * A key is mandatory here rather than optional, and for the same reason the confirmation is the one
	 * change operation that demands one: applying a change twice moves the order twice, and a client
	 * that never saw the first answer has no other way to tell whether it landed. A retry that presents
	 * the key of the attempt that was lost is answered with the change that attempt applied.
	 *
	 * The version is the **order's**, which the route names in its path: the guard reads that order and
	 * refuses a change applied against an order that has moved on before the handler runs, and the
	 * order's own write checks the same version again in the statement that increments it.
	 *
	 * @param id The order.
	 * @param changeId The change.
	 * @param request The request, which carries the version the caller read the order at.
	 * @returns The change and the order it moved.
	 */
	@ApiOperation({ summary: 'Apply an order change' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Change applied' })
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Idempotent({ scope: 'order.change.confirm', required: true, resourceType: 'order_change' })
	@Versioned({ resource: OrderService })
	@Post(':id/changes/:changeId/confirm')
	@HttpCode(HttpStatus.OK)
	async confirmChange(
		@Param('id', UUIDValidationPipe) id: string,
		@Param('changeId', UUIDValidationPipe) changeId: string,
		@Req() request: Request
	) {
		return this.changeService.confirm(changeId, versionExpectationOf(request));
	}

	/**
	 * Declines a change without applying it.
	 *
	 * The path names the change and not the order, so the guard states no resource: it reads and
	 * validates the version the caller presents, and the handler resolves the order the change belongs
	 * to and predicates the order's own write on it — which is where the comparison is made.
	 *
	 * @param changeId The change.
	 * @param body The reason.
	 * @param request The request, which carries the version the caller read the order at.
	 * @returns The declined change.
	 */
	@ApiOperation({ summary: 'Decline an order change' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Change declined' })
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Versioned({})
	@Post('changes/:changeId/decline')
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ transform: true, whitelist: true })
	async declineChange(
		@Param('changeId', UUIDValidationPipe) changeId: string,
		@Body() body: { reason?: string },
		@Req() request: Request
	) {
		return this.changeService.decline(changeId, body?.reason, versionExpectationOf(request));
	}

	/**
	 * Cancels a pending change.
	 *
	 * The path names the change and not the order, so the guard states no resource: it reads and
	 * validates the version the caller presents, and the handler resolves the order the change belongs
	 * to and predicates the order's own write on it — which is where the comparison is made.
	 *
	 * @param changeId The change.
	 * @param body The reason.
	 * @param request The request, which carries the version the caller read the order at.
	 * @returns The cancelled change.
	 */
	@ApiOperation({ summary: 'Cancel an order change' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Change cancelled' })
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Versioned({})
	@Post('changes/:changeId/cancel')
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ transform: true, whitelist: true })
	async cancelChange(
		@Param('changeId', UUIDValidationPipe) changeId: string,
		@Body() body: { reason?: string },
		@Req() request: Request
	) {
		return this.changeService.cancel(changeId, body?.reason, versionExpectationOf(request));
	}

	/**
	 * Lists orders.
	 *
	 * @param options The query options.
	 * @returns A page of orders.
	 */
	@ApiOperation({ summary: 'List orders' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Orders found' })
	@Get()
	@UseValidationPipe()
	async findAll(@Query() options: BaseQueryDTO<Order>): Promise<IPagination<IOrder>> {
		return this.orderService.findAll(options);
	}

	/**
	 * Deletes an order by id.
	 *
	 * The route belongs to `CrudController`, which declares it with no permission metadata of its own, and
	 * `PermissionGuard` answers `true` to empty metadata — its `isEmpty(permissions)` return in
	 * `packages/core/src/lib/shared/guards/permission.guard.ts` — so the inherited handler demanded nothing
	 * beyond this controller's class-level view grant. This override exists only to state that permission:
	 * the path and the body are the base class's, and the grant is `ORDERS_EDIT`, the same one the archive
	 * mutation on this resource already requires.
	 *
	 * @param id The order.
	 * @returns The result of the delete.
	 */
	@ApiOperation({ summary: 'Delete an order' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The order was deleted' })
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Delete(':id')
	@HttpCode(HttpStatus.ACCEPTED)
	async delete(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return super.delete(id);
	}

	/**
	 * Soft deletes an order by id.
	 *
	 * `CrudController` declares this route with no permission metadata at all, and `PermissionGuard`
	 * returns `true` to empty metadata — the `isEmpty(permissions)` branch in
	 * `packages/core/src/lib/shared/guards/permission.guard.ts` — so the inherited route was reachable on
	 * this controller's class-level view grant alone. The override restates the route and its body
	 * unchanged and adds only the permission the base class omits: `ORDERS_EDIT`, the grant the archive
	 * mutation on this resource already requires.
	 *
	 * @param id The order.
	 * @returns The soft-deleted order.
	 */
	@ApiOperation({ summary: 'Soft delete an order' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The order was soft deleted' })
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Delete(':id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a soft-deleted order by id.
	 *
	 * The route is `CrudController`'s, declared there with no permission metadata whatsoever, and
	 * `PermissionGuard` treats empty metadata as authorization — it returns `true` in the
	 * `isEmpty(permissions)` branch of `packages/core/src/lib/shared/guards/permission.guard.ts` — which is
	 * what left the inherited handler open to every authenticated member of the tenant. This override
	 * exists only to state its permission, `ORDERS_EDIT`, on the same path and the same body.
	 *
	 * @param id The order.
	 * @returns The restored order.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted order' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The order was restored' })
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Put(':id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRecover(id, ...options);
	}
}
