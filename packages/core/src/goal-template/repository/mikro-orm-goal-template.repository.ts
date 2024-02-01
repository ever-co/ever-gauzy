import { EntityRepository } from '@mikro-orm/core';
import { GoalTemplate } from '../goal-template.entity';

export class MikroOrmGoalTemplateRepository extends EntityRepository<GoalTemplate> { }