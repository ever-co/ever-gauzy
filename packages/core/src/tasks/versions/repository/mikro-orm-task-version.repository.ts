import { EntityRepository } from '@mikro-orm/knex';
import { TaskVersion } from '../version.entity';

export class MikroOrmTaskVersionRepository extends EntityRepository<TaskVersion> { }
