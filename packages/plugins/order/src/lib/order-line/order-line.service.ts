import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from '@gauzy/core';
import { OrderLine } from './order-line.entity';
import { TypeOrmOrderLineRepository } from './repository/type-orm-order-line.repository';
import { MikroOrmOrderLineRepository } from './repository/mikro-orm-order-line.repository';

/**
 * the lines of an order: what was bought, at the price it was bought at. The quantity counters are caches of the fulfilment and return rows that cause them and are never authored here.
 */
@Injectable()
export class OrderLineService extends TenantAwareCrudService<OrderLine> {
	constructor(
		readonly typeOrmOrderLineRepository: TypeOrmOrderLineRepository,
		readonly mikroOrmOrderLineRepository: MikroOrmOrderLineRepository
	) {
		super(typeOrmOrderLineRepository, mikroOrmOrderLineRepository);
	}
}