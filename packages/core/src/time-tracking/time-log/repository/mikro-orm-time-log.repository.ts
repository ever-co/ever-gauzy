import { EntityRepository } from '@mikro-orm/knex';
import { TimeLog } from '../time-log.entity';

export class MikroOrmTimeLogRepository extends EntityRepository<TimeLog> { }
