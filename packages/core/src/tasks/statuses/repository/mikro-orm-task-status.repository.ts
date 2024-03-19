import { EntityRepository } from '@mikro-orm/knex';
import { TaskStatus } from '../status.entity';

export class MikroOrmTaskStatusRepository extends EntityRepository<TaskStatus> { }
