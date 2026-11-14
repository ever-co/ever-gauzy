import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimeGoal } from '../time-goal.entity';

@Injectable()
export class TypeOrmTimeGoalRepository extends Repository<TimeGoal> {
	constructor(@InjectRepository(TimeGoal) readonly repository: Repository<TimeGoal>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
