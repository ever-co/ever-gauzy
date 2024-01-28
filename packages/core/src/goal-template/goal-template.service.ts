import { MikroInjectRepository } from '@gauzy/common';
import { EntityRepository } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from './../core/crud';
import { GoalTemplate } from './goal-template.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class GoalTemplateService extends TenantAwareCrudService<GoalTemplate> {
	constructor(
		@InjectRepository(GoalTemplate)
		goalTemplateRepository: Repository<GoalTemplate>,
		@MikroInjectRepository(GoalTemplate)
		mikroGoalTemplateRepository: EntityRepository<GoalTemplate>
	) {
		super(goalTemplateRepository, mikroGoalTemplateRepository);
	}
}
