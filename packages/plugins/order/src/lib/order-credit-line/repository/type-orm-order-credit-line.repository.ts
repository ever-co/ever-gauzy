import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderCreditLine } from '../order-credit-line.entity';

@Injectable()
export class TypeOrmOrderCreditLineRepository extends Repository<OrderCreditLine> {
	constructor(@InjectRepository(OrderCreditLine) readonly repository: Repository<OrderCreditLine>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}