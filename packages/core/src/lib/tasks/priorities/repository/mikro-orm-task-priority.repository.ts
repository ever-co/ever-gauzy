import { MikroOrmBaseEntityRepository } from '../../../core/repository/mikro-orm-base-entity.repository';
import { TaskPriority } from '../priority.entity';

export class MikroOrmTaskPriorityRepository extends MikroOrmBaseEntityRepository<TaskPriority> { }
