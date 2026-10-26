import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderClaim } from '../order-claim.entity';

@Injectable()
export class TypeOrmOrderClaimRepository extends Repository<OrderClaim> {
	constructor(@InjectRepository(OrderClaim) readonly repository: Repository<OrderClaim>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
