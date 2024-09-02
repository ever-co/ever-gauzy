import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { TimeOffPolicy } from '../time-off-policy.entity';

export class MikroOrmTimeOffPolicyRepository extends MikroOrmBaseEntityRepository<TimeOffPolicy> {}
