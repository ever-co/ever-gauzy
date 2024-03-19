import { EntityRepository } from '@mikro-orm/knex';
import { GoalTimeFrame } from '../goal-time-frame.entity';

export class MikroOrmGoalTimeFrameRepository extends EntityRepository<GoalTimeFrame> { }
