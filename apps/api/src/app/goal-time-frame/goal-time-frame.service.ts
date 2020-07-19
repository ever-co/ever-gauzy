import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GoalTimeFrame } from './goal-time-frame.entity';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';

@Injectable()
export class GoalTimeFrameService extends TenantAwareCrudService<
	GoalTimeFrame
> {
	constructor(
		@InjectRepository(GoalTimeFrame)
		private readonly goalTimeFrameRepository: Repository<GoalTimeFrame>
	) {
		super(goalTimeFrameRepository);
	}
}
