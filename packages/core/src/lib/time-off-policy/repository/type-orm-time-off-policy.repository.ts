import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimeOffPolicy } from '../time-off-policy.entity';

@Injectable()
export class TypeOrmTimeOffPolicyRepository extends Repository<TimeOffPolicy> {
	constructor(@InjectRepository(TimeOffPolicy) readonly repository: Repository<TimeOffPolicy>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
