import { Controller, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CrudController, Permissions, PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { OrderShippingMethod } from './order-shipping-method.entity';
import { OrderShippingMethodService } from './order-shipping-method.service';
import { ORDER_PERMISSIONS } from '../order.permissions';

/**
 * The OrderShippingMethod resource.
 *
 * One controller per entity, on the entity's own concept path, with the same guards and permissions the
 * rest of the platform uses. There is no second surface for this resource and no parallel controller.
 */
@ApiTags('OrderShippingMethod')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(ORDER_PERMISSIONS.ORDERS_VIEW)
@Controller('/order-shipping-methods')
export class OrderShippingMethodController extends CrudController<OrderShippingMethod> {
	constructor(private readonly service: OrderShippingMethodService) {
		super(service);
	}
}