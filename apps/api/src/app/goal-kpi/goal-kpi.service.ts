import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GoalKPI } from './goal-kpi.entity';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';

@Injectable()
export class GoalKpiService extends TenantAwareCrudService<GoalKPI> {
	constructor(
		@InjectRepository(GoalKPI)
		private readonly goalKpiRepository: Repository<GoalKPI>
	) {
		super(goalKpiRepository);
	}
}
