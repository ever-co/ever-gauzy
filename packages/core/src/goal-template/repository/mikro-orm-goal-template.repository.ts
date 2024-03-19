import { EntityRepository } from '@mikro-orm/knex';
import { GoalTemplate } from '../goal-template.entity';

export class MikroOrmGoalTemplateRepository extends EntityRepository<GoalTemplate> { }
