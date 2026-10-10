import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderTransaction } from '../order-transaction.entity';

@Injectable()
export class TypeOrmOrderTransactionRepository extends Repository<OrderTransaction> {
	constructor(@InjectRepository(OrderTransaction) readonly repository: Repository<OrderTransaction>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}