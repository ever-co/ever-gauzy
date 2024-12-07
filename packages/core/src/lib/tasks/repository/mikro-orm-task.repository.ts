import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { Task } from '../task.entity';

export class MikroOrmTaskRepository extends MikroOrmBaseEntityRepository<Task> {
}
