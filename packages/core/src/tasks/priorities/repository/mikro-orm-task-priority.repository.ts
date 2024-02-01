import { EntityRepository } from '@mikro-orm/core';
import { TaskPriority } from '../priority.entity';

export class MikroOrmTaskPriorityRepository extends EntityRepository<TaskPriority> { }
