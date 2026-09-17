import { Controller, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CrudController, Permissions, PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { FulfillmentLine } from './fulfillment-line.entity';
import { FulfillmentLineService } from './fulfillment-line.service';
import { FULFILLMENT_PERMISSIONS } from '../fulfillment.permissions';

/**
 * The FulfillmentLine resource.
 *
 * One controller per entity, on the entity's own concept path, with the same guards and permissions the
 * rest of the platform uses. There is no second surface and no parallel controller for this resource.
 */
@ApiTags('FulfillmentLine')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(FULFILLMENT_PERMISSIONS.FULFILLMENTS_VIEW)
@Controller('/fulfillment-lines')
export class FulfillmentLineController extends CrudController<FulfillmentLine> {
	constructor(private readonly service: FulfillmentLineService) {
		super(service);
	}
}