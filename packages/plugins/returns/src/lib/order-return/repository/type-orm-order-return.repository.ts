import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderReturn } from '../order-return.entity';

@Injectable()
export class TypeOrmOrderReturnRepository extends Repository<OrderReturn> {
	constructor(@InjectRepository(OrderReturn) readonly repository: Repository<OrderReturn>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
