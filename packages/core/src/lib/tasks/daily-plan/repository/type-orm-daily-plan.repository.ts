import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DailyPlan } from '../daily-plan.entity';

@Injectable()
export class TypeOrmDailyPlanRepository extends Repository<DailyPlan> {
	constructor(@InjectRepository(DailyPlan) readonly repository: Repository<DailyPlan>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
