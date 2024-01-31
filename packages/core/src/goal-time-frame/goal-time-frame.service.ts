import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { GoalTimeFrame } from './goal-time-frame.entity';
import { TenantAwareCrudService } from './../core/crud';
import { MikroOrmGoalTimeFrameRepository } from './repository/mikro-orm-goal-time-frame.repository';
import { TypeOrmGoalTimeFrameRepository } from './repository/type-orm-goal-time-frame.repository';

@Injectable()
export class GoalTimeFrameService extends TenantAwareCrudService<GoalTimeFrame> {
	constructor(
		@InjectRepository(GoalTimeFrame)
		typeOrmGoalTimeFrameRepository: TypeOrmGoalTimeFrameRepository,

		mikroOrmGoalTimeFrameRepository: MikroOrmGoalTimeFrameRepository
	) {
		super(typeOrmGoalTimeFrameRepository, mikroOrmGoalTimeFrameRepository);
	}
}
