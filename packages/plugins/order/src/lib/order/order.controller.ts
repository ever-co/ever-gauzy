import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IPagination, IOrder, OrderChangeType } from '@gauzy/contracts';
import {
	BaseQueryDTO,
	CrudController,
	Permissions,
	PermissionGuard,
	TenantPermissionGuard,
	UUIDValidationPipe,
	UseValidationPipe
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
	 * @param entity The order to create.
	 * @returns The created order.
	 */
	@ApiOperation({ summary: 'Create a draft order' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Order created' })
	@Permissions(ORDER_PERMISSIONS.ORDERS_CREATE)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateOrderDTO): Promise<IOrder> {
		return this.orderService.create(entity as any);
	}

	/**
	 * Reads an order with the satellites a caller needs to render it.
	 *
	 * @param id The order.
	 * @returns The order.
	 */
	@ApiOperation({ summary: 'Find an order by id' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Order found' })
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
	 * @returns The order.
	 */
	@ApiOperation({ summary: 'Update an order' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Order updated' })
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: UpdateOrderDTO
	): Promise<IOrder> {
		return this.orderService.updateMutable(id, entity as any);
	}

	/**
	 * Places a draft order.
	 *
	 * @param id The order.
	 * @returns The placed order.
	 */
	@ApiOperation({ summary: 'Place a draft order' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Order placed' })
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Post(':id/place')
	@HttpCode(HttpStatus.OK)
	async place(@Param('id', UUIDValidationPipe) id: string): Promise<IOrder> {
		return this.orderService.place(id);
	}

	/**
	 * Confirms a placed order.
	 *
	 * @param id The order.
	 * @returns The confirmed order.
	 */
	@ApiOperation({ summary: 'Confirm a placed order' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Order confirmed' })
	@Permissions(ORDER_PERMISSIONS.ORDERS_APPROVE)
	@Post(':id/approve')
	@HttpCode(HttpStatus.OK)
	async approve(@Param('id', UUIDValidationPipe) id: string): Promise<IOrder> {
		return this.orderService.confirm(id, 'STAFF');
	}

	/**
	 * Cancels an order that nothing has shipped from.
	 *
	 * @param id The order.
	 * @param body The reason.
	 * @returns The cancelled order.
	 */
	@ApiOperation({ summary: 'Cancel an order' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Order cancelled' })
	@Permissions(ORDER_PERMISSIONS.ORDERS_CANCEL)
	@Post(':id/cancel')
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ transform: true, whitelist: true })
	async cancel(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() body: { reason?: string }
	): Promise<IOrder> {
		return this.orderService.cancel(id, body?.reason);
	}

	/**
	 * Archives a terminal order.
	 *
	 * @param id The order.
	 * @returns The archived order.
	 */
	@ApiOperation({ summary: 'Archive an order' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Order archived' })
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Post(':id/archive')
	@HttpCode(HttpStatus.OK)
	async archive(@Param('id', UUIDValidationPipe) id: string): Promise<IOrder> {
		return this.orderService.archive(id);
	}

	/**
	 * Recomputes an order's totals from its lines and the money ledgers.
	 *
	 * @param id The order.
	 * @returns The order with its recomputed totals.
	 */
	@ApiOperation({ summary: 'Recalculate an order' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Order recalculated' })
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Post(':id/recalculate')
	@HttpCode(HttpStatus.OK)
	async recalculate(@Param('id', UUIDValidationPipe) id: string): Promise<IOrder> {
		return this.totalsService.recompute(id, 'MANUAL');
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
	 * @param id The order.
	 * @param entity The credit to apply.
	 * @returns The change that carries the credit.
	 */
	@ApiOperation({ summary: 'Apply a credit line to an order' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Credit line applied' })
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
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
	 * @param id The order.
	 * @param changeId The change.
	 * @returns The change and the order it moved.
	 */
	@ApiOperation({ summary: 'Apply an order change' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Change applied' })
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Post(':id/changes/:changeId/confirm')
	@HttpCode(HttpStatus.OK)
	async confirmChange(
		@Param('id', UUIDValidationPipe) id: string,
		@Param('changeId', UUIDValidationPipe) changeId: string
	) {
		return this.changeService.confirm(changeId);
	}

	/**
	 * Declines a change without applying it.
	 *
	 * @param changeId The change.
	 * @param body The reason.
	 * @returns The declined change.
	 */
	@ApiOperation({ summary: 'Decline an order change' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Change declined' })
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Post('changes/:changeId/decline')
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ transform: true, whitelist: true })
	async declineChange(
		@Param('changeId', UUIDValidationPipe) changeId: string,
		@Body() body: { reason?: string }
	) {
		return this.changeService.decline(changeId, body?.reason);
	}

	/**
	 * Cancels a pending change.
	 *
	 * @param changeId The change.
	 * @param body The reason.
	 * @returns The cancelled change.
	 */
	@ApiOperation({ summary: 'Cancel an order change' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Change cancelled' })
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Post('changes/:changeId/cancel')
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ transform: true, whitelist: true })
	async cancelChange(
		@Param('changeId', UUIDValidationPipe) changeId: string,
		@Body() body: { reason?: string }
	) {
		return this.changeService.cancel(changeId, body?.reason);
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
}
