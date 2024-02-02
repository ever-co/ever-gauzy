import { EntityRepository } from '@mikro-orm/core';
import { Task } from '../task.entity';

export class MikroOrmTaskRepository extends EntityRepository<Task> { }
