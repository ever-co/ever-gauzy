import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderExchangeLine } from '../order-exchange-line.entity';

@Injectable()
export class TypeOrmOrderExchangeLineRepository extends Repository<OrderExchangeLine> {
	constructor(@InjectRepository(OrderExchangeLine) readonly repository: Repository<OrderExchangeLine>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
