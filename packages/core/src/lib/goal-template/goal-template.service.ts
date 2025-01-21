import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from './../core/crud';
import { GoalTemplate } from './goal-template.entity';
import { MikroOrmGoalTemplateRepository } from './repository/mikro-orm-goal-template.repository';
import { TypeOrmGoalTemplateRepository } from './repository/type-orm-goal-template.repository';

@Injectable()
export class GoalTemplateService extends TenantAwareCrudService<GoalTemplate> {
	constructor(
		typeOrmGoalTemplateRepository: TypeOrmGoalTemplateRepository,
		mikroOrmGoalTemplateRepository: MikroOrmGoalTemplateRepository
	) {
		super(typeOrmGoalTemplateRepository, mikroOrmGoalTemplateRepository);
	}
}
