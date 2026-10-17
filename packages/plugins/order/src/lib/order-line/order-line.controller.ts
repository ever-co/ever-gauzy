import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Post, Put, UseGuards, UsePipes } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID } from '@gauzy/contracts';
import {
	AbstractValidationPipe,
	CrudController,
	Idempotent,
	Permissions,
	PermissionGuard,
	TenantOrganizationBaseDTO,
	TenantPermissionGuard,
	UUIDValidationPipe,
	UseValidationPipe
} from '@gauzy/core';
import { OrderLine } from './order-line.entity';
import { OrderLineService } from './order-line.service';
import { OrderEditGuard } from '../order/order-edit.guard';
import { ORDER_PERMISSIONS } from '../order.permissions';
import { CreateOrderLineDTO, RecordOrderLineRefundDTO, UpdateOrderLineDTO } from './dto';

/**
 * The OrderLine resource.
 *
 * One controller per entity, on the entity's own concept path, with the same guards and permissions the
 * rest of the platform uses. There is no second surface for this resource and no parallel controller.
 *
 * `@Idempotent(...)` is on the create route because a create is what a lost response turns into a
 * duplicate: a client that never saw the answer cannot tell whether the line exists, so the key it
 * presents is answered from the record of the first attempt rather than by adding the line again.
 */
@ApiTags('OrderLine')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(ORDER_PERMISSIONS.ORDERS_VIEW)
@Controller('/order-lines')
export class OrderLineController extends CrudController<OrderLine> {
	constructor(
		private readonly service: OrderLineService,
		private readonly editGuard: OrderEditGuard
	) {
		super(service);
	}

	/**
	 * Refuses a write to this row once its order is placed (review R3-11): a placed order changes through an order
	 * change, which versions, prices and re-derives it. `OrderEditGuard` states the rule.
	 *
	 * @param id The row.
	 * @param withDeleted Whether a retired row is read too (a restore reads one).
	 */
	private async assertEditable(id: ID, withDeleted = false): Promise<void> {
		const stored = await this.service.findOneByIdString(id, withDeleted ? ({ withDeleted: true } as never) : undefined);

		await this.editGuard.assertDraft(stored.orderId, 'order line');
	}

	/**
	 * Creates an order line.
	 *
	 * The write routes are declared here rather than inherited, because a request body is validated
	 * from the *type* the handler names: the base class takes the entity's shape as a generic, whose
	 * reflected type is `Object`, and Nest's validation pipe skips a parameter it cannot name a class
	 * for. An inherited `create` therefore accepts any body at all — an unknown enumeration member, a
	 * missing required field, a property the resource does not have. Declaring the DTO is what makes
	 * the request validated, and it is also what gives the route a documented body.
	 */
	@ApiOperation({ summary: 'Create an order line' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The order line was created', type: OrderLine })
	@Permissions(ORDER_PERMISSIONS.ORDERS_CREATE)
	@Idempotent({ scope: 'order.line.create', required: false, resourceType: 'order_line' })
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateOrderLineDTO): Promise<OrderLine> {
		await this.editGuard.assertDraft(entity.orderId, 'order line');

		return this.service.create(entity as any);
	}

	/**
	 * Updates an order line.
	 *
	 * The return type is the base class's own: the inherited service answers `update` with the ORM's
	 * update result as readily as with the row, so narrowing it to the entity would be untrue.
	 */
	@ApiOperation({ summary: 'Update an order line' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The order line was updated', type: OrderLine })
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: UpdateOrderLineDTO): Promise<any> {
		const stored = await this.service.findOneByIdString(id);

		this.editGuard.assertSameOrder(stored.orderId, (entity as { orderId?: ID }).orderId, 'order line');
		await this.editGuard.assertDraft(stored.orderId, 'order line');

		return this.service.update(id, entity as any);
	}

	/**
	 * Records one refund against a line, in as many parts as it was paid in.
	 *
	 * The register is the order's, and the evidence is the payment domain's: the `refund_line` rows
	 * belong to that capability and this package must not read them, so the payment side reports what it
	 * paid back and this route moves the counter in one guarded write. Two partial refunds of one line
	 * are therefore two calls, and the register accumulates both.
	 *
	 * @param id The order line.
	 * @param entity The refund to record.
	 * @returns The line, as it now stands.
	 */
	@ApiOperation({ summary: 'Record a refund against an order line' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The refund was recorded and the register moved.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'The refund exceeds what the line invoiced.' })
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Post(':id/refunds')
	@UseValidationPipe({ transform: true, whitelist: true })
	async recordRefund(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: RecordOrderLineRefundDTO
	): Promise<OrderLine> {
		return await this.service.recordRefund({ orderLineId: id, ...entity });
	}

	/**
	 * Retires an order line. This route no longer erases one.
	 *
	 * The `DELETE ':id'` route belongs to `CrudController`, whose handler hard-deletes the row. `13` §11.4 keeps every
	 * order table in one retention row — "`order*`, `payment` (the columns this programme adds), `payment_capture`,
	 * `refund`, `tax_line`, `adjustment`, `subscription_billing`, `order_return*` | Indefinite | Soft delete only
	 * (`deletedAt`); no hard delete through the API" — and the owner decided it again on 2026-10-13 ("Soft delete
	 * only").
	 *
	 * A line carries the price its order was placed at — "editing a price list must not rewrite history"
	 * (`order-line.entity.ts`) — and the counters its invoices, fulfilments and returns moved.
	 *
	 * The route therefore retires the row exactly as `DELETE ':id/soft'` does: through the service's `softRemove`,
	 * which keeps the row with `deletedAt` set and lets `PUT ':id/recover'` bring it back. There is no hard-delete path
	 * through the API. The route's path, its status and its permission — `ORDERS_EDIT`, which the base class leaves
	 * unstated — are unchanged.
	 *
	 * @param id The order line to retire.
	 * @param options The inherited rest parameter; the retirement reads the row in the caller's scope.
	 * @returns The retired order line.
	 */
	@ApiOperation({ summary: 'Retire an order line (soft delete; it is never hard-deleted)' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The order line was retired' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Order line not found' })
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Delete(':id')
	@HttpCode(HttpStatus.ACCEPTED)
	async delete(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<any> {
		await this.assertEditable(id);

		return await this.service.softRemove(id);
	}

	/**
	 * Soft deletes an order line by id.
	 *
	 * `CrudController` declares this route with no permission metadata at all, and `PermissionGuard`
	 * returns `true` to empty metadata — the `isEmpty(permissions)` branch in
	 * `packages/core/src/lib/shared/guards/permission.guard.ts` — so the inherited route was reachable on
	 * this controller's class-level view grant alone. The override restates the route and its body
	 * unchanged and adds only the permission the base class omits: `ORDERS_EDIT`.
	 *
	 * @param id The order line.
	 * @returns The soft-deleted order line.
	 */
	@ApiOperation({ summary: 'Soft delete an order line' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The order line was soft deleted' })
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Delete(':id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<any> {
		await this.assertEditable(id);

		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a soft-deleted order line by id.
	 *
	 * The route is `CrudController`'s, declared there with no permission metadata whatsoever, and
	 * `PermissionGuard` treats empty metadata as authorization — it returns `true` in the
	 * `isEmpty(permissions)` branch of `packages/core/src/lib/shared/guards/permission.guard.ts` — which is
	 * what left the inherited handler open to every authenticated member of the tenant. This override
	 * exists only to state its permission, `ORDERS_EDIT`, on the same path and the same body.
	 *
	 * @param id The order line.
	 * @returns The restored order line.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted order line' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The order line was restored' })
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Put(':id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<any> {
		await this.assertEditable(id, true);

		return await super.softRecover(id, ...options);
	}
}
