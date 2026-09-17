import { Controller, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CrudController, Permissions, PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { OrderHistory } from './order-history.entity';
import { OrderHistoryService } from './order-history.service';
import { ORDER_PERMISSIONS } from '../order.permissions';

/**
 * The OrderHistory resource.
 *
 * One controller per entity, on the entity's own concept path, with the same guards and permissions the
 * rest of the platform uses. There is no second surface for this resource and no parallel controller.
 */
@ApiTags('OrderHistory')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(ORDER_PERMISSIONS.ORDERS_VIEW)
@Controller('/order-history')
export class OrderHistoryController extends CrudController<OrderHistory> {
	constructor(private readonly service: OrderHistoryService) {
		super(service);
	}
}