import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TenantAwareCrudService } from './../core/crud';
import { GoalKPITemplate } from './goal-kpi-template.entity';
import { MikroOrmGoalKPITemplateRepository } from './repository/mikro-orm-goal-kpi-template.repository';
import { TypeOrmGoalKPITemplateRepository } from './repository/type-orm-goal-kpi-template.repository';

@Injectable()
export class GoalKpiTemplateService extends TenantAwareCrudService<GoalKPITemplate> {
	constructor(
		@InjectRepository(GoalKPITemplate)
		typeOrmGoalKPITemplateRepository: TypeOrmGoalKPITemplateRepository,

		mikroOrmGoalKPITemplateRepository: MikroOrmGoalKPITemplateRepository
	) {
		super(typeOrmGoalKPITemplateRepository, mikroOrmGoalKPITemplateRepository);
	}
}
