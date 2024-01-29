import { Repository } from 'typeorm';
import { GoalKPI } from '../goal-kpi.entity';

export class TypeOrmGoalKPIRepository extends Repository<GoalKPI> { }
