import { Controller, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CrudController, Permissions, PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { OrderSummary } from './order-summary.entity';
import { OrderSummaryService } from './order-summary.service';
import { ORDER_PERMISSIONS } from '../order.permissions';

/**
 * The OrderSummary resource.
 *
 * One controller per entity, on the entity's own concept path, with the same guards and permissions the
 * rest of the platform uses. There is no second surface for this resource and no parallel controller.
 */
@ApiTags('OrderSummary')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(ORDER_PERMISSIONS.ORDERS_VIEW)
@Controller('/order-summaries')
export class OrderSummaryController extends CrudController<OrderSummary> {
	constructor(private readonly service: OrderSummaryService) {
		super(service);
	}
}