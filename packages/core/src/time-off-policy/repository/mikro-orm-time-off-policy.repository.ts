import { EntityRepository } from '@mikro-orm/core';
import { TimeOffPolicy } from '../time-off-policy.entity';

export class MikroOrmTimeOffPolicyRepository extends EntityRepository<TimeOffPolicy> { }