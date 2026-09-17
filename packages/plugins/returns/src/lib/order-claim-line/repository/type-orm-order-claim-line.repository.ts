import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderClaimLine } from '../order-claim-line.entity';

@Injectable()
export class TypeOrmOrderClaimLineRepository extends Repository<OrderClaimLine> {
	constructor(@InjectRepository(OrderClaimLine) readonly repository: Repository<OrderClaimLine>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
