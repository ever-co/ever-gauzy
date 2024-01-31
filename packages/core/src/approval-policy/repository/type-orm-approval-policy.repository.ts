import { Repository } from 'typeorm';
import { ApprovalPolicy } from '../approval-policy.entity';

export class TypeOrmApprovalPolicyRepository extends Repository<ApprovalPolicy> { }