import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from '@gauzy/core';
import { CommerceCartShippingMethod } from './commerce-cart-shipping-method.entity';
import { TypeOrmCommerceCartShippingMethodRepository } from './repository/type-orm-commerce-cart-shipping-method.repository';
import { MikroOrmCommerceCartShippingMethodRepository } from './repository/mikro-orm-commerce-cart-shipping-method.repository';

/**
 * The delivery choices held against a cart.
 *
 * The price is computed by the shipping calculation strategy and recorded here; this service never
 * prices a delivery itself, and it never writes the cart's `shippingSubtotal` — the totals calculator
 * derives that from these rows.
 */
@Injectable()
export class CommerceCartShippingMethodService extends TenantAwareCrudService<CommerceCartShippingMethod> {
	constructor(
		readonly typeOrmCommerceCartShippingMethodRepository: TypeOrmCommerceCartShippingMethodRepository,
		readonly mikroOrmCommerceCartShippingMethodRepository: MikroOrmCommerceCartShippingMethodRepository
	) {
		super(typeOrmCommerceCartShippingMethodRepository, mikroOrmCommerceCartShippingMethodRepository);
	}
}
