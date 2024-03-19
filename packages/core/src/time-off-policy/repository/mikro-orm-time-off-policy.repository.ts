import { EntityRepository } from '@mikro-orm/knex';
import { TimeOffPolicy } from '../time-off-policy.entity';

export class MikroOrmTimeOffPolicyRepository extends EntityRepository<TimeOffPolicy> { }
