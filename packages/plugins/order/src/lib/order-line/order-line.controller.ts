import { Controller, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CrudController, Permissions, PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { OrderLine } from './order-line.entity';
import { OrderLineService } from './order-line.service';
import { ORDER_PERMISSIONS } from '../order.permissions';

/**
 * The OrderLine resource.
 *
 * One controller per entity, on the entity's own concept path, with the same guards and permissions the
 * rest of the platform uses. There is no second surface for this resource and no parallel controller.
 */
@ApiTags('OrderLine')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(ORDER_PERMISSIONS.ORDERS_VIEW)
@Controller('/order-lines')
export class OrderLineController extends CrudController<OrderLine> {
	constructor(private readonly service: OrderLineService) {
		super(service);
	}
}