import { Controller, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CrudController, Permissions, PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { OrderCreditLine } from './order-credit-line.entity';
import { OrderCreditLineService } from './order-credit-line.service';
import { ORDER_PERMISSIONS } from '../order.permissions';

/**
 * The OrderCreditLine resource.
 *
 * One controller per entity, on the entity's own concept path, with the same guards and permissions the
 * rest of the platform uses. There is no second surface for this resource and no parallel controller.
 */
@ApiTags('OrderCreditLine')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(ORDER_PERMISSIONS.ORDERS_VIEW)
@Controller('/order-credit-lines')
export class OrderCreditLineController extends CrudController<OrderCreditLine> {
	constructor(private readonly service: OrderCreditLineService) {
		super(service);
	}
}