import { Injectable } from '@nestjs/common';
import { OrderShippingMethod } from './order-shipping-method.entity';
import { TypeOrmOrderShippingMethodRepository } from './repository/type-orm-order-shipping-method.repository';
import { MikroOrmOrderShippingMethodRepository } from './repository/mikro-orm-order-shipping-method.repository';
import { OrderCrudService } from '../order-crud.service';

/**
 * the delivery choices frozen on an order. Their amounts are snapshots and their sum is the order shipping subtotal.
 */
@Injectable()
export class OrderShippingMethodService extends OrderCrudService<OrderShippingMethod> {
	constructor(
		readonly typeOrmOrderShippingMethodRepository: TypeOrmOrderShippingMethodRepository,
		readonly mikroOrmOrderShippingMethodRepository: MikroOrmOrderShippingMethodRepository
	) {
		super(typeOrmOrderShippingMethodRepository, mikroOrmOrderShippingMethodRepository);
	}
}