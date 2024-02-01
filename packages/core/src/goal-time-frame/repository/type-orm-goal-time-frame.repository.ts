import { Repository } from 'typeorm';
import { GoalTimeFrame } from '../goal-time-frame.entity';

export class TypeOrmGoalTimeFrameRepository extends Repository<GoalTimeFrame> { }