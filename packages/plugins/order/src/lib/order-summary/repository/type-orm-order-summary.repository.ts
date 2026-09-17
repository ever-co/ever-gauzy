import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderSummary } from '../order-summary.entity';

@Injectable()
export class TypeOrmOrderSummaryRepository extends Repository<OrderSummary> {
	constructor(@InjectRepository(OrderSummary) readonly repository: Repository<OrderSummary>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}