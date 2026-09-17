import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from '@gauzy/core';
import { OrderTransaction } from './order-transaction.entity';
import { TypeOrmOrderTransactionRepository } from './repository/type-orm-order-transaction.repository';
import { MikroOrmOrderTransactionRepository } from './repository/mikro-orm-order-transaction.repository';

/**
 * the order payment ledger. Append-only: a correction is a new row of the opposite kind, never an edit and never a deletion.
 */
@Injectable()
export class OrderTransactionService extends TenantAwareCrudService<OrderTransaction> {
	constructor(
		readonly typeOrmOrderTransactionRepository: TypeOrmOrderTransactionRepository,
		readonly mikroOrmOrderTransactionRepository: MikroOrmOrderTransactionRepository
	) {
		super(typeOrmOrderTransactionRepository, mikroOrmOrderTransactionRepository);
	}
}