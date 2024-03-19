import { EntityRepository } from '@mikro-orm/knex';
import { TaskEstimation } from '../task-estimation.entity';

export class MikroOrmTaskEstimationRepository extends EntityRepository<TaskEstimation> { }
