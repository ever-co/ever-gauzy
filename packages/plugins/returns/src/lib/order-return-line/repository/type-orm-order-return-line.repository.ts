import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderReturnLine } from '../order-return-line.entity';

@Injectable()
export class TypeOrmOrderReturnLineRepository extends Repository<OrderReturnLine> {
	constructor(@InjectRepository(OrderReturnLine) readonly repository: Repository<OrderReturnLine>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
