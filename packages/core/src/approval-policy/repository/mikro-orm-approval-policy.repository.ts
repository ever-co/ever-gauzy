import { EntityRepository } from '@mikro-orm/core';
import { ApprovalPolicy } from '../approval-policy.entity';

export class MikroOrmApprovalPolicyRepository extends EntityRepository<ApprovalPolicy> { }