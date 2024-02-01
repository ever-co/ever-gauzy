import { EntityRepository } from '@mikro-orm/core';
import { GoalTimeFrame } from '../goal-time-frame.entity';

export class MikroOrmGoalTimeFrameRepository extends EntityRepository<GoalTimeFrame> { }