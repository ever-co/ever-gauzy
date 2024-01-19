import { MikroInjectRepository } from '@gauzy/common';
import { EntityRepository } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Goal } from './goal.entity';
import { Repository } from 'typeorm';
import { TenantAwareCrudService } from './../core/crud';

@Injectable()
export class GoalService extends TenantAwareCrudService<Goal> {
	constructor(
		@InjectRepository(Goal)
		private readonly goalRepository: Repository<Goal>,
		@MikroInjectRepository(Goal)
		private readonly mikroGoalRepository: EntityRepository<Goal>
	) {
		super(goalRepository, mikroGoalRepository);
	}
}
