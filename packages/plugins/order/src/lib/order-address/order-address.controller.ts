import { Controller, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CrudController, Permissions, PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { OrderAddress } from './order-address.entity';
import { OrderAddressService } from './order-address.service';
import { ORDER_PERMISSIONS } from '../order.permissions';

/**
 * The OrderAddress resource.
 *
 * One controller per entity, on the entity's own concept path, with the same guards and permissions the
 * rest of the platform uses. There is no second surface for this resource and no parallel controller.
 */
@ApiTags('OrderAddress')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(ORDER_PERMISSIONS.ORDERS_VIEW)
@Controller('/order-addresses')
export class OrderAddressController extends CrudController<OrderAddress> {
	constructor(private readonly service: OrderAddressService) {
		super(service);
	}
}