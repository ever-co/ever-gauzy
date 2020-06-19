import { Injectable } from '@nestjs/common';
import { CrudService } from '../core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GoalTimeFrame } from './goal-time-frame.entity';

@Injectable()
export class GoalTimeFrameService extends CrudService<GoalTimeFrame> {
	constructor(
		@InjectRepository(GoalTimeFrame)
		private readonly goalTimeFrameRepository: Repository<GoalTimeFrame>
	) {
		super(goalTimeFrameRepository);
	}
}
