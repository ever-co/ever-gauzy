import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderChange } from '../order-change.entity';

@Injectable()
export class TypeOrmOrderChangeRepository extends Repository<OrderChange> {
	constructor(@InjectRepository(OrderChange) readonly repository: Repository<OrderChange>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}