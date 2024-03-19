import { EntityRepository } from '@mikro-orm/knex';
import { ApprovalPolicy } from '../approval-policy.entity';

export class MikroOrmApprovalPolicyRepository extends EntityRepository<ApprovalPolicy> { }
