import { EntityRepository } from '@mikro-orm/core';
import { GoalKPI } from '../goal-kpi.entity';

export class MikroOrmGoalKPIRepository extends EntityRepository<GoalKPI> { }
