import { EntityRepository } from '@mikro-orm/knex';
import { TimeOffRequest } from '../time-off-request.entity';

export class MikroOrmTimeOffRequestRepository extends EntityRepository<TimeOffRequest> { }
