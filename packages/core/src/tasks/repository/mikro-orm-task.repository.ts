import { EntityRepository } from '@mikro-orm/knex';
import { Task } from '../task.entity';

export class MikroOrmTaskRepository extends EntityRepository<Task> {
}
