import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderLine } from '../order-line.entity';

@Injectable()
export class TypeOrmOrderLineRepository extends Repository<OrderLine> {
	constructor(@InjectRepository(OrderLine) readonly repository: Repository<OrderLine>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}