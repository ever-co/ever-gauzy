import { MikroInjectRepository } from '@gauzy/common';
import { EntityRepository } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GoalKPI } from './goal-kpi.entity';
import { TenantAwareCrudService } from './../core/crud';

@Injectable()
export class GoalKpiService extends TenantAwareCrudService<GoalKPI> {
	constructor(
		@InjectRepository(GoalKPI)
		goalKpiRepository: Repository<GoalKPI>,
		@MikroInjectRepository(GoalKPI)
		mikroGoalKpiRepository: EntityRepository<GoalKPI>
	) {
		super(goalKpiRepository, mikroGoalKpiRepository);
	}
}
