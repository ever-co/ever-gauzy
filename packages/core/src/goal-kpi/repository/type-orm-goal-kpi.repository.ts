import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GoalKPI } from '../goal-kpi.entity';

@Injectable()
export class TypeOrmGoalKPIRepository extends Repository<GoalKPI> {
    constructor(@InjectRepository(GoalKPI) readonly repository: Repository<GoalKPI>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
