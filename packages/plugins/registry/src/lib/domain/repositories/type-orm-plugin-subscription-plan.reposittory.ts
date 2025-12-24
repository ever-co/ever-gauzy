import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PluginSubscriptionPlan } from '../entities/plugin-subscription-plan.entity';

@Injectable()
export class TypeOrmPluginSubscriptionPlanRepository extends Repository<PluginSubscriptionPlan> {
	constructor(@InjectRepository(PluginSubscriptionPlan) readonly repository: Repository<PluginSubscriptionPlan>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
