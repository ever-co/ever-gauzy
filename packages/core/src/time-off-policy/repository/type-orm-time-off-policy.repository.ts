import { Repository } from 'typeorm';
import { TimeOffPolicy } from '../time-off-policy.entity';

export class TypeOrmTimeOffPolicyRepository extends Repository<TimeOffPolicy> { }