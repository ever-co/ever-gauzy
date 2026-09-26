import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderExchange } from '../order-exchange.entity';

@Injectable()
export class TypeOrmOrderExchangeRepository extends Repository<OrderExchange> {
	constructor(@InjectRepository(OrderExchange) readonly repository: Repository<OrderExchange>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
