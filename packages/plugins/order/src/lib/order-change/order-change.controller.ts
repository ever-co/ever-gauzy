import {
	Body,
	Controller,
	Delete,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	Req,
	UseGuards,
	UsePipes
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { ID } from '@gauzy/contracts';
import {
	AbstractValidationPipe,
	CrudController,
	Permissions,
	PermissionGuard,
	TenantOrganizationBaseDTO,
	TenantPermissionGuard,
	UUIDValidationPipe,
	UseValidationPipe,
	Versioned,
	versionExpectationOf
} from '@gauzy/core';
import { OrderChange } from './order-change.entity';
import { OrderChangeService } from './order-change.service';
import { OrderService } from '../order/order.service';
import { ORDER_PERMISSIONS } from '../order.permissions';
import { CreateOrderChangeDTO, UpdateOrderChangeDTO } from './dto';

/**
 * The OrderChange resource.
 *
 * One controller per entity, on the entity's own concept path, with the same guards and permissions the
 * rest of the platform uses. There is no second surface for this resource and no parallel controller.
 *
 * The version both write routes take is the **order's**, never the change's: a change has no version of
 * its own — the `version` column on the row is the order version the change produces — so a caller
 * states the version of the order it read, and the order's own conditional update is what checks and
 * increments it. Creating a change names its order in the body, so the guard reads that order and
 * refuses a change requested against one that has moved on; updating a change names only the change, so
 * the handler resolves the order and predicates the order's write on the stated version.
 */
@ApiTags('OrderChange')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(ORDER_PERMISSIONS.ORDERS_VIEW)
@Controller('/order-changes')
export class OrderChangeController extends CrudController<OrderChange> {
	constructor(private readonly service: OrderChangeService) {
		super(service);
	}

	/**
	 * Creates an order change.
	 *
	 * The write routes are declared here rather than inherited, because a request body is validated
	 * from the *type* the handler names: the base class takes the entity's shape as a generic, whose
	 * reflected type is `Object`, and Nest's validation pipe skips a parameter it cannot name a class
	 * for. An inherited `create` therefore accepts any body at all — an unknown enumeration member, a
	 * missing required field, a property the resource does not have. Declaring the DTO is what makes
	 * the request validated, and it is also what gives the route a documented body.
	 *
	 * The change is planned against an order, and the body names it, so the version is read from that
	 * order: a change requested against an order that has moved on is refused before anything is
	 * recorded.
	 */
	@ApiOperation({ summary: 'Create an order change' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The order change was created', type: OrderChange })
	@Permissions(ORDER_PERMISSIONS.ORDERS_CREATE)
	@Versioned({ resource: OrderService, identify: (request: any) => request?.body?.orderId })
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateOrderChangeDTO): Promise<OrderChange> {
		return this.service.create(entity as any);
	}

	/**
	 * Updates an order change.
	 *
	 * The route names the change and not the order, so the guard states no resource: it reads and
	 * validates the version the caller presents, the service resolves the order the change belongs to,
	 * and the order's own conditional update is what compares the stated version and refuses one that
	 * has moved on — a row predicated through the aggregate the change is part of rather than through a
	 * lock of its own.
	 */
	@ApiOperation({ summary: 'Update an order change' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The order change was updated', type: OrderChange })
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Versioned({})
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateOrderChangeDTO,
		@Req() request: Request
	): Promise<any> {
		return this.service.commitChange(id, entity as any, versionExpectationOf(request));
	}

	/**
	 * Retires an order change. This route no longer erases one.
	 *
	 * The `DELETE ':id'` route belongs to `CrudController`, whose handler hard-deletes the row. `13` §11.4 keeps every
	 * order table in one retention row — "`order*`, `payment` (the columns this programme adds), `payment_capture`,
	 * `refund`, `tax_line`, `adjustment`, `subscription_billing`, `order_return*` | Indefinite | Soft delete only
	 * (`deletedAt`); no hard delete through the API" — and the owner decided it again on 2026-10-13 ("Soft delete
	 * only").
	 *
	 * A change is the only path that modifies a placed order, and an undone change keeps "every one of its rows"
	 * (`order-change.entity.ts`): the row is the audit of a modification.
	 *
	 * The route therefore retires the row exactly as `DELETE ':id/soft'` does: through the service's `softRemove`,
	 * which keeps the row with `deletedAt` set and lets `PUT ':id/recover'` bring it back. There is no hard-delete path
	 * through the API. The route's path, its status and its permission — `ORDERS_EDIT`, which the base class leaves
	 * unstated — are unchanged.
	 *
	 * @param id The order change to retire.
	 * @param options The inherited rest parameter; the retirement reads the row in the caller's scope.
	 * @returns The retired order change.
	 */
	@ApiOperation({ summary: 'Retire an order change (soft delete; it is never hard-deleted)' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The order change was retired' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Order change not found' })
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Delete(':id')
	@HttpCode(HttpStatus.ACCEPTED)
	async delete(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<any> {
		return await this.service.softRemove(id);
	}

	/**
	 * Soft deletes an order change by id.
	 *
	 * `CrudController` declares this route with no permission metadata at all, and `PermissionGuard`
	 * returns `true` to empty metadata — the `isEmpty(permissions)` branch in
	 * `packages/core/src/lib/shared/guards/permission.guard.ts` — so the inherited route was reachable on
	 * this controller's class-level view grant alone. The override restates the route and its body
	 * unchanged and adds only the permission the base class omits: `ORDERS_EDIT`.
	 *
	 * @param id The order change.
	 * @returns The soft-deleted order change.
	 */
	@ApiOperation({ summary: 'Soft delete an order change' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The order change was soft deleted' })
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Delete(':id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<any> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a soft-deleted order change by id.
	 *
	 * The route is `CrudController`'s, declared there with no permission metadata whatsoever, and
	 * `PermissionGuard` treats empty metadata as authorization — it returns `true` in the
	 * `isEmpty(permissions)` branch of `packages/core/src/lib/shared/guards/permission.guard.ts` — which is
	 * what left the inherited handler open to every authenticated member of the tenant. This override
	 * exists only to state its permission, `ORDERS_EDIT`, on the same path and the same body.
	 *
	 * @param id The order change.
	 * @returns The restored order change.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted order change' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The order change was restored' })
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Put(':id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<any> {
		return await super.softRecover(id, ...options);
	}
}
