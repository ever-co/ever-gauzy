import { Controller, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CrudController, Permissions, PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { OrderChange } from './order-change.entity';
import { OrderChangeService } from './order-change.service';
import { ORDER_PERMISSIONS } from '../order.permissions';

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
}