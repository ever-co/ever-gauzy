import { Controller, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CrudController, Permissions, PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { OrderTransaction } from './order-transaction.entity';
import { OrderTransactionService } from './order-transaction.service';
import { ORDER_PERMISSIONS } from '../order.permissions';

/**
 * The OrderTransaction resource.
 *
 * One controller per entity, on the entity's own concept path, with the same guards and permissions the
 * rest of the platform uses. There is no second surface for this resource and no parallel controller.
 */
@ApiTags('OrderTransaction')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(ORDER_PERMISSIONS.ORDERS_VIEW)
@Controller('/order-transactions')
export class OrderTransactionController extends CrudController<OrderTransaction> {
	constructor(private readonly service: OrderTransactionService) {
		super(service);
	}
}