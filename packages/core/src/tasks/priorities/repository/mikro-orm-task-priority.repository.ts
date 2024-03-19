import { EntityRepository } from '@mikro-orm/knex';
import { TaskPriority } from '../priority.entity';

export class MikroOrmTaskPriorityRepository extends EntityRepository<TaskPriority> { }
