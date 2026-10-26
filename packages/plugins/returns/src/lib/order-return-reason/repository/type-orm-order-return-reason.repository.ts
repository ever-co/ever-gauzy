import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderReturnReason } from '../order-return-reason.entity';

@Injectable()
export class TypeOrmOrderReturnReasonRepository extends Repository<OrderReturnReason> {
	constructor(@InjectRepository(OrderReturnReason) readonly repository: Repository<OrderReturnReason>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
