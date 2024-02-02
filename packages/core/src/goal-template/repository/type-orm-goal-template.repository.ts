import { Repository } from 'typeorm';
import { GoalTemplate } from '../goal-template.entity';

export class TypeOrmGoalTemplateRepository extends Repository<GoalTemplate> { }