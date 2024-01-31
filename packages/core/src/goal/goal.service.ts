import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Goal } from './goal.entity';
import { TenantAwareCrudService } from './../core/crud';
import { TypeOrmGoalRepository } from './repository/type-orm-goal.repository';
import { MikroOrmGoalRepository } from './repository/mikro-orm-goal.repository';

@Injectable()
export class GoalService extends TenantAwareCrudService<Goal> {
	constructor(
		@InjectRepository(Goal)
		typeOrmGoalRepository: TypeOrmGoalRepository,

		mikroOrmGoalRepository: MikroOrmGoalRepository
	) {
		super(typeOrmGoalRepository, mikroOrmGoalRepository);
	}
}
