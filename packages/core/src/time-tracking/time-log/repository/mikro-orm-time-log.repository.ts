import { EntityRepository } from '@mikro-orm/core';
import { TimeLog } from '../time-log.entity';

export class MikroOrmTimeLogRepository extends EntityRepository<TimeLog> { }