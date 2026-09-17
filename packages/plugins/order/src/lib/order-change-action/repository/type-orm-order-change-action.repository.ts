import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderChangeAction } from '../order-change-action.entity';

@Injectable()
export class TypeOrmOrderChangeActionRepository extends Repository<OrderChangeAction> {
	constructor(@InjectRepository(OrderChangeAction) readonly repository: Repository<OrderChangeAction>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}