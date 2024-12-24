import { MikroOrmBaseEntityRepository } from '../../../core/repository/mikro-orm-base-entity.repository';
import { TaskStatus } from '../status.entity';

export class MikroOrmTaskStatusRepository extends MikroOrmBaseEntityRepository<TaskStatus> { }
