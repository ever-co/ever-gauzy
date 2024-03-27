import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { ApprovalPolicy } from '../approval-policy.entity';

export class MikroOrmApprovalPolicyRepository extends MikroOrmBaseEntityRepository<ApprovalPolicy> { }
