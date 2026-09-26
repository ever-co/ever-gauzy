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
	constructor(private readonly service: OrderLineService) {
		super(service);
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
	 * Deletes an order line by id.
	 *
	 * The route belongs to `CrudController`, which declares it with no permission metadata of its own, and
	 * `PermissionGuard` answers `true` to empty metadata — its `isEmpty(permissions)` return in
	 * `packages/core/src/lib/shared/guards/permission.guard.ts` — so the inherited handler demanded nothing
	 * beyond this controller's class-level view grant. This override exists only to state that permission:
	 * the path and the body are the base class's, and the grant is `ORDERS_EDIT`, the same one this
	 * resource's update route already requires.
	 *
	 * @param id The order line.
	 * @returns The result of the delete.
	 */
	@ApiOperation({ summary: 'Delete an order line' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The order line was deleted' })
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Delete(':id')
	@HttpCode(HttpStatus.ACCEPTED)
	async delete(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<any> {
		return super.delete(id);
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
		return await super.softRecover(id, ...options);
	}
}
