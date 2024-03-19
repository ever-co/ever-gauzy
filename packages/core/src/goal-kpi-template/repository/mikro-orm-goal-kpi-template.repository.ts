import { EntityRepository } from '@mikro-orm/knex';
import { GoalKPITemplate } from '../goal-kpi-template.entity';

export class MikroOrmGoalKPITemplateRepository extends EntityRepository<GoalKPITemplate> { }
