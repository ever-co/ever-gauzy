import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Goal } from './goal.entity';
import { Repository } from 'typeorm';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';

@Injectable()
export class GoalService extends TenantAwareCrudService<Goal> {
	constructor(
		@InjectRepository(Goal)
		private readonly goalRepository: Repository<Goal>
	) {
		super(goalRepository);
	}
}
