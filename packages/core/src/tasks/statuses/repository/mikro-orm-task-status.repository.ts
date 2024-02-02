import { EntityRepository } from '@mikro-orm/core';
import { TaskStatus } from '../status.entity';

export class MikroOrmTaskStatusRepository extends EntityRepository<TaskStatus> { }
