import { Body, Controller, HttpCode, HttpStatus, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID } from '@gauzy/contracts';
import {
	CrudController,
	Permissions,
	PermissionGuard,
	TenantPermissionGuard,
	UUIDValidationPipe,
	UseValidationPipe
} from '@gauzy/core';
import { OrderChange } from './order-change.entity';
import { OrderChangeService } from './order-change.service';
import { ORDER_PERMISSIONS } from '../order.permissions';
import { CreateOrderChangeDTO, UpdateOrderChangeDTO } from './dto';

/**
 * The OrderChange resource.
 *
 * One controller per entity, on the entity's own concept path, with the same guards and permissions the
 * rest of the platform uses. There is no second surface for this resource and no parallel controller.
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
	 */
	@ApiOperation({ summary: 'Create an order change' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The order change was created', type: OrderChange })
	@Permissions(ORDER_PERMISSIONS.ORDERS_CREATE)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateOrderChangeDTO): Promise<OrderChange> {
		return this.service.create(entity as any);
	}

	/**
	 * Updates an order change.
	 *
	 * The return type is the base class's own: the inherited service answers `update` with the ORM's
	 * update result as readily as with the row, so narrowing it to the entity would be untrue.
	 */
	@ApiOperation({ summary: 'Update an order change' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The order change was updated', type: OrderChange })
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: UpdateOrderChangeDTO): Promise<any> {
		return this.service.update(id, entity as any);
	}
}
