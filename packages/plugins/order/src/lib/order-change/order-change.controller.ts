import { Body, Controller, HttpCode, HttpStatus, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { ID } from '@gauzy/contracts';
import {
	CrudController,
	Permissions,
	PermissionGuard,
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
}
