import { Controller, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CrudController, Permissions, PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { ShippingProfileVariant } from './shipping-profile-variant.entity';
import { ShippingProfileVariantService } from './shipping-profile-variant.service';
import { FULFILLMENT_PERMISSIONS } from '../fulfillment.permissions';

/**
 * The ShippingProfileVariant resource.
 *
 * One controller per entity, on the entity's own concept path, with the same guards and permissions the
 * rest of the platform uses. There is no second surface and no parallel controller for this resource.
 */
@ApiTags('ShippingProfileVariant')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(FULFILLMENT_PERMISSIONS.SHIPPING_OPTIONS_VIEW)
@Controller('/shipping-profile-variants')
export class ShippingProfileVariantController extends CrudController<ShippingProfileVariant> {
	constructor(private readonly service: ShippingProfileVariantService) {
		super(service);
	}
}