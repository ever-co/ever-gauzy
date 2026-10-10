import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from '@gauzy/core';
import { OrderShippingMethod } from './order-shipping-method.entity';
import { TypeOrmOrderShippingMethodRepository } from './repository/type-orm-order-shipping-method.repository';
import { MikroOrmOrderShippingMethodRepository } from './repository/mikro-orm-order-shipping-method.repository';

/**
 * the delivery choices frozen on an order. Their amounts are snapshots and their sum is the order shipping subtotal.
 */
@Injectable()
export class OrderShippingMethodService extends TenantAwareCrudService<OrderShippingMethod> {
	constructor(
		readonly typeOrmOrderShippingMethodRepository: TypeOrmOrderShippingMethodRepository,
		readonly mikroOrmOrderShippingMethodRepository: MikroOrmOrderShippingMethodRepository
	) {
		super(typeOrmOrderShippingMethodRepository, mikroOrmOrderShippingMethodRepository);
	}
}