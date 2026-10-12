import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../order.entity';

@Injectable()
export class TypeOrmOrderRepository extends Repository<Order> {
	constructor(@InjectRepository(Order) readonly repository: Repository<Order>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}