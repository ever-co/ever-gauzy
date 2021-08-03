import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from './../core/crud';
import { GoalKPITemplate } from './goal-kpi-template.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class GoalKpiTemplateService extends TenantAwareCrudService<GoalKPITemplate> {
	constructor(
		@InjectRepository(GoalKPITemplate)
		private readonly goalKpiTemplateRepository: Repository<GoalKPITemplate>
	) {
		super(goalKpiTemplateRepository);
	}
}
