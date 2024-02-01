import { Repository } from 'typeorm';
import { Goal } from '../goal.entity';

export class TypeOrmGoalRepository extends Repository<Goal> { }