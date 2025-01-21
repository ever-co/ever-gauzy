import { Injectable } from '@nestjs/common';
import { Goal } from './goal.entity';
import { TenantAwareCrudService } from './../core/crud';
import { TypeOrmGoalRepository } from './repository/type-orm-goal.repository';
import { MikroOrmGoalRepository } from './repository/mikro-orm-goal.repository';

@Injectable()
export class GoalService extends TenantAwareCrudService<Goal> {
	constructor(typeOrmGoalRepository: TypeOrmGoalRepository, mikroOrmGoalRepository: MikroOrmGoalRepository) {
		super(typeOrmGoalRepository, mikroOrmGoalRepository);
	}
}
