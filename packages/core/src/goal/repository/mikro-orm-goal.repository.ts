import { EntityRepository } from '@mikro-orm/knex';
import { Goal } from '../goal.entity';

export class MikroOrmGoalRepository extends EntityRepository<Goal> { }
