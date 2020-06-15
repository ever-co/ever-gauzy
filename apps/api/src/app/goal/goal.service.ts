import { Injectable } from '@nestjs/common';
import { CrudService } from '../core';
import { InjectRepository } from '@nestjs/typeorm';
import { Goal } from './goal.entity';
import { Repository } from 'typeorm';

@Injectable()
export class GoalService extends CrudService<Goal> {
	constructor(
		@InjectRepository(Goal)
		private readonly goalRepository: Repository<Goal>
	) {
		super(goalRepository);
	}
}
