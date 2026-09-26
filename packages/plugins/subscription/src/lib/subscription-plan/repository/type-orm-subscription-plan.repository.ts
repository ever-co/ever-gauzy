import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubscriptionPlan } from '../subscription-plan.entity';

@Injectable()
export class TypeOrmSubscriptionPlanRepository extends Repository<SubscriptionPlan> {
	constructor(@InjectRepository(SubscriptionPlan) readonly repository: Repository<SubscriptionPlan>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
