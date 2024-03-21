import { MikroOrmBaseEntityRepository } from '../../../core/repository/mikro-orm-base-entity.repository';
import { TaskEstimation } from '../task-estimation.entity';

export class MikroOrmTaskEstimationRepository extends MikroOrmBaseEntityRepository<TaskEstimation> { }
