import { EntityRepository } from '@mikro-orm/knex';
import { GoalKPI } from '../goal-kpi.entity';

export class MikroOrmGoalKPIRepository extends EntityRepository<GoalKPI> { }
