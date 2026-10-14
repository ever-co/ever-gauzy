import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Post, Put, UseGuards, UsePipes } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID } from '@gauzy/contracts';
import {
	AbstractValidationPipe,
	CrudController,
	Permissions,
	PermissionGuard,
	TenantOrganizationBaseDTO,
	TenantPermissionGuard,
	UUIDValidationPipe,
	UseValidationPipe
} from '@gauzy/core';
import { OrderTransaction } from './order-transaction.entity';
import { OrderTransactionService } from './order-transaction.service';
import { OrderTotalsService } from '../order-totals/order-totals.service';
import { ORDER_PERMISSIONS } from '../order.permissions';
import { CreateOrderTransactionDTO, UpdateOrderTransactionDTO } from './dto';

/**
 * The OrderTransaction resource.
 *
 * One controller per entity, on the entity's own concept path, with the same guards and permissions the
 * rest of the platform uses. There is no second surface for this resource and no parallel controller.
 */
@ApiTags('OrderTransaction')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(ORDER_PERMISSIONS.ORDERS_VIEW)
@Controller('/order-transactions')
export class OrderTransactionController extends CrudController<OrderTransaction> {
	constructor(
		private readonly service: OrderTransactionService,
		private readonly totalsService: OrderTotalsService
	) {
		super(service);
	}

	/**
	 * Records an operator's `MANUAL` correction on an order's payment ledger, in the order's currency, and re-derives
	 * the order (review R3-11). Every other kind of row is written by the operation that causes it and is refused here
	 * (`ORDER_TRANSACTION_NOT_MANUAL`); the ledger is append-only, so the update, delete and retire routes below answer
	 * `ORDER_LEDGER_APPEND_ONLY`.
	 *
	 * The write routes are declared here rather than inherited, because a request body is validated
	 * from the *type* the handler names: the base class takes the entity's shape as a generic, whose
	 * reflected type is `Object`, and Nest's validation pipe skips a parameter it cannot name a class
	 * for. An inherited `create` therefore accepts any body at all — an unknown enumeration member, a
	 * missing required field, a property the resource does not have. Declaring the DTO is what makes
	 * the request validated, and it is also what gives the route a documented body.
	 */
	@ApiOperation({ summary: 'Record a MANUAL correction on an order payment ledger' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The order transaction was created', type: OrderTransaction })
	@Permissions(ORDER_PERMISSIONS.ORDERS_CREATE)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateOrderTransactionDTO): Promise<OrderTransaction> {
		const row = await this.service.recordManual(entity as any);

		// ADR-26: every ledger move re-derives the order, so the correction is counted now, not at the nightly pass.
		await this.totalsService.recompute(row.orderId, 'PAYMENT_RECONCILED');

		return row;
	}

	/**
	 * Refused: a ledger row is never edited (`ORDER_LEDGER_APPEND_ONLY`, review R3-11); the correction is a new
	 * `MANUAL` row through the route above.
	 *
	 * The return type is the base class's own: the inherited service answers `update` with the ORM's
	 * update result as readily as with the row, so narrowing it to the entity would be untrue.
	 */
	@ApiOperation({ summary: 'Update an order transaction' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The order transaction was updated', type: OrderTransaction })
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateOrderTransactionDTO
	): Promise<any> {
		return this.service.update(id, entity as any);
	}

	/**
	 * Retires an order transaction. This route no longer erases one.
	 *
	 * The `DELETE ':id'` route belongs to `CrudController`, whose handler hard-deletes the row. `13` §11.4 keeps every
	 * order table in one retention row — "`order*`, `payment` (the columns this programme adds), `payment_capture`,
	 * `refund`, `tax_line`, `adjustment`, `subscription_billing`, `order_return*` | Indefinite | Soft delete only
	 * (`deletedAt`); no hard delete through the API" — and the owner decided it again on 2026-10-13 ("Soft delete
	 * only").
	 *
	 * The ledger is "**Append-only.** A row is never updated and never deleted" (`order-transaction.entity.ts`): the
	 * order's paid, refunded and outstanding totals are derived from these rows.
	 *
	 * The route therefore retires the row exactly as `DELETE ':id/soft'` does: through the service's `softRemove`,
	 * which keeps the row with `deletedAt` set and lets `PUT ':id/recover'` bring it back. There is no hard-delete path
	 * through the API. The route's path, its status and its permission — `ORDERS_EDIT`, which the base class leaves
	 * unstated — are unchanged.
	 *
	 * @param id The order transaction to retire.
	 * @param options The inherited rest parameter; the retirement reads the row in the caller's scope.
	 * @returns The retired order transaction.
	 */
	@ApiOperation({ summary: 'Retire an order transaction (soft delete; it is never hard-deleted)' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The order transaction was retired' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Order transaction not found' })
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Delete(':id')
	@HttpCode(HttpStatus.ACCEPTED)
	async delete(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<any> {
		return await this.service.softRemove(id);
	}

	/**
	 * Soft deletes an order transaction by id.
	 *
	 * `CrudController` declares this route with no permission metadata at all, and `PermissionGuard`
	 * returns `true` to empty metadata — the `isEmpty(permissions)` branch in
	 * `packages/core/src/lib/shared/guards/permission.guard.ts` — so the inherited route was reachable on
	 * this controller's class-level view grant alone. The override restates the route and its body
	 * unchanged and adds only the permission the base class omits: `ORDERS_EDIT`.
	 *
	 * @param id The order transaction.
	 * @returns The soft-deleted order transaction.
	 */
	@ApiOperation({ summary: 'Soft delete an order transaction' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The order transaction was soft deleted' })
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Delete(':id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<any> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a soft-deleted order transaction by id.
	 *
	 * The route is `CrudController`'s, declared there with no permission metadata whatsoever, and
	 * `PermissionGuard` treats empty metadata as authorization — it returns `true` in the
	 * `isEmpty(permissions)` branch of `packages/core/src/lib/shared/guards/permission.guard.ts` — which is
	 * what left the inherited handler open to every authenticated member of the tenant. This override
	 * exists only to state its permission, `ORDERS_EDIT`, on the same path and the same body.
	 *
	 * @param id The order transaction.
	 * @returns The restored order transaction.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted order transaction' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The order transaction was restored' })
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Put(':id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<any> {
		return await super.softRecover(id, ...options);
	}
}
