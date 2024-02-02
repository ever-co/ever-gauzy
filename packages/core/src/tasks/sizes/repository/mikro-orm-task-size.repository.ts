import { EntityRepository } from '@mikro-orm/core';
import { TaskSize } from '../size.entity';

export class MikroOrmTaskSizeRepository extends EntityRepository<TaskSize> { }
