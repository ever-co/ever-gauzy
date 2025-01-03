import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TenantAwareCrudService } from './../core/crud';
import { GoalTemplate } from './goal-template.entity';
import { MikroOrmGoalTemplateRepository } from './repository/mikro-orm-goal-template.repository';
import { TypeOrmGoalTemplateRepository } from './repository/type-orm-goal-template.repository';

@Injectable()
export class GoalTemplateService extends TenantAwareCrudService<GoalTemplate> {
	constructor(
		@InjectRepository(GoalTemplate)
		typeOrmGoalTemplateRepository: TypeOrmGoalTemplateRepository,

		mikroOrmGoalTemplateRepository: MikroOrmGoalTemplateRepository
	) {
		super(typeOrmGoalTemplateRepository, mikroOrmGoalTemplateRepository);
	}
}
