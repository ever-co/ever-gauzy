import { Controller, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CrudController, Permissions, PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { CommerceCartShippingMethod } from './commerce-cart-shipping-method.entity';
import { CommerceCartShippingMethodService } from './commerce-cart-shipping-method.service';
import { CART_PERMISSIONS } from '../cart.permissions';

/**
 * The cart delivery-choice resource.
 *
 * The set-and-replace route lives on the cart, because replacing a delivery choice is a cart-level
 * operation; this controller addresses one method by its own id.
 */
@ApiTags('CartShippingMethod')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(CART_PERMISSIONS.CARTS_VIEW)
@Controller('/cart-shipping-methods')
export class CommerceCartShippingMethodController extends CrudController<CommerceCartShippingMethod> {
	constructor(private readonly commerceCartShippingMethodService: CommerceCartShippingMethodService) {
		super(commerceCartShippingMethodService);
	}
}
