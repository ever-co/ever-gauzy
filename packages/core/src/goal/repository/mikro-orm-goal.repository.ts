import { EntityRepository } from '@mikro-orm/core';
import { Goal } from '../goal.entity';

export class MikroOrmGoalRepository extends EntityRepository<Goal> { }