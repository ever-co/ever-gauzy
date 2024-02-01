import { EntityRepository } from '@mikro-orm/core';
import { TaskEstimation } from '../task-estimation.entity';

export class MikroOrmTaskEstimationRepository extends EntityRepository<TaskEstimation> { }
