import { Repository } from 'typeorm';
import { TimeOffPolicy } from '../time-off-policy.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';

@Injectable()
export class TypeOrmTimeOffPolicyRepository extends Repository<TimeOffPolicy> {
	constructor(@InjectRepository(TimeOffPolicy) readonly repository: Repository<TimeOffPolicy>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
