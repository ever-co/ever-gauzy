import { EntityRepository } from '@mikro-orm/knex';
import { TaskSize } from '../size.entity';

export class MikroOrmTaskSizeRepository extends EntityRepository<TaskSize> { }
