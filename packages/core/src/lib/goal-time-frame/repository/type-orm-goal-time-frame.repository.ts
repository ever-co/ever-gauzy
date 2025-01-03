import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GoalTimeFrame } from '../goal-time-frame.entity';

@Injectable()
export class TypeOrmGoalTimeFrameRepository extends Repository<GoalTimeFrame> {
    constructor(@InjectRepository(GoalTimeFrame) readonly repository: Repository<GoalTimeFrame>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
