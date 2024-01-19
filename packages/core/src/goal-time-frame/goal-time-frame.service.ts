import { MikroInjectRepository } from '@gauzy/common';
import { EntityRepository } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GoalTimeFrame } from './goal-time-frame.entity';
import { TenantAwareCrudService } from './../core/crud';

@Injectable()
export class GoalTimeFrameService extends TenantAwareCrudService<GoalTimeFrame> {
	constructor(
		@InjectRepository(GoalTimeFrame)
		private readonly goalTimeFrameRepository: Repository<GoalTimeFrame>,
		@MikroInjectRepository(GoalTimeFrame)
		private readonly mikroGoalTimeFrameRepository: EntityRepository<GoalTimeFrame>
	) {
		super(goalTimeFrameRepository, mikroGoalTimeFrameRepository);
	}
}
