import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApprovalPolicy } from '../approval-policy.entity';

@Injectable()
export class TypeOrmApprovalPolicyRepository extends Repository<ApprovalPolicy> {
    constructor(@InjectRepository(ApprovalPolicy) readonly repository: Repository<ApprovalPolicy>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
