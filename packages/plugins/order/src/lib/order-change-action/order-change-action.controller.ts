import { Controller, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CrudController, Permissions, PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { OrderChangeAction } from './order-change-action.entity';
import { OrderChangeActionService } from './order-change-action.service';
import { ORDER_PERMISSIONS } from '../order.permissions';

/**
 * The OrderChangeAction resource.
 *
 * One controller per entity, on the entity's own concept path, with the same guards and permissions the
 * rest of the platform uses. There is no second surface for this resource and no parallel controller.
 */
@ApiTags('OrderChangeAction')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(ORDER_PERMISSIONS.ORDERS_VIEW)
@Controller('/order-change-actions')
export class OrderChangeActionController extends CrudController<OrderChangeAction> {
	constructor(private readonly service: OrderChangeActionService) {
		super(service);
	}
}