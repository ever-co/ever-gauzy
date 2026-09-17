import { Controller, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CrudController, Permissions, PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { CommerceCartPromotion } from './commerce-cart-promotion.entity';
import { CommerceCartPromotionService } from './commerce-cart-promotion.service';
import { CART_PERMISSIONS } from '../cart.permissions';

/**
 * The applied-promotion resource.
 *
 * Applying and removing a promotion are cart-level operations and live on the cart; this controller
 * exposes the snapshot rows a caller may read to explain a basket's discount.
 */
@ApiTags('CartPromotion')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(CART_PERMISSIONS.CARTS_VIEW)
@Controller('/cart-promotions')
export class CommerceCartPromotionController extends CrudController<CommerceCartPromotion> {
	constructor(private readonly commerceCartPromotionService: CommerceCartPromotionService) {
		super(commerceCartPromotionService);
	}
}
