import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderHistory } from '../order-history.entity';

@Injectable()
export class TypeOrmOrderHistoryRepository extends Repository<OrderHistory> {
	constructor(@InjectRepository(OrderHistory) readonly repository: Repository<OrderHistory>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}