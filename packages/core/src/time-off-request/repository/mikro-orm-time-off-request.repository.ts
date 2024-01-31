import { EntityRepository } from '@mikro-orm/core';
import { TimeOffRequest } from '../time-off-request.entity';

export class MikroOrmTimeOffRequestRepository extends EntityRepository<TimeOffRequest> { }