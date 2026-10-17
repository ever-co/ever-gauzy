import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from '@gauzy/core';
import { OrderCreditLine } from './order-credit-line.entity';
import { TypeOrmOrderCreditLineRepository } from './repository/type-orm-order-credit-line.repository';
import { MikroOrmOrderCreditLineRepository } from './repository/mikro-orm-order-credit-line.repository';

/**
 * money owed back to the buyer: neither a payment nor a discount, and the reason an order can be fully settled while reporting that no money was paid.
 */
@Injectable()
export class OrderCreditLineService extends TenantAwareCrudService<OrderCreditLine> {
	constructor(
		readonly typeOrmOrderCreditLineRepository: TypeOrmOrderCreditLineRepository,
		readonly mikroOrmOrderCreditLineRepository: MikroOrmOrderCreditLineRepository
	) {
		super(typeOrmOrderCreditLineRepository, mikroOrmOrderCreditLineRepository);
	}
}