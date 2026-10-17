import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from '@gauzy/core';
import { OrderChangeAction } from './order-change-action.entity';
import { TypeOrmOrderChangeActionRepository } from './repository/type-orm-order-change-action.repository';
import { MikroOrmOrderChangeActionRepository } from './repository/mikro-orm-order-change-action.repository';

/**
 * the actions of a change. They are validated as a set before any is applied and then applied in ordering sequence inside one transaction.
 */
@Injectable()
export class OrderChangeActionService extends TenantAwareCrudService<OrderChangeAction> {
	constructor(
		readonly typeOrmOrderChangeActionRepository: TypeOrmOrderChangeActionRepository,
		readonly mikroOrmOrderChangeActionRepository: MikroOrmOrderChangeActionRepository
	) {
		super(typeOrmOrderChangeActionRepository, mikroOrmOrderChangeActionRepository);
	}
}