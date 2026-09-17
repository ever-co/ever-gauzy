import { Controller, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CrudController, Permissions, PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { CommerceCartLine } from './commerce-cart-line.entity';
import { CommerceCartLineService } from './commerce-cart-line.service';
import { CART_PERMISSIONS } from '../cart.permissions';

/**
 * The cart-line resource.
 *
 * A line is a child of its cart, so the add, change and remove routes are additionally reachable one
 * level deep from the cart itself; this controller is where a line is addressed by its own id.
 */
@ApiTags('CartLine')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(CART_PERMISSIONS.CARTS_VIEW)
@Controller('/cart-lines')
export class CommerceCartLineController extends CrudController<CommerceCartLine> {
	constructor(private readonly commerceCartLineService: CommerceCartLineService) {
		super(commerceCartLineService);
	}
}
