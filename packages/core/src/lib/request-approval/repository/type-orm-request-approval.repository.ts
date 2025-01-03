import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequestApproval } from '../request-approval.entity';

@Injectable()
export class TypeOrmRequestApprovalRepository extends Repository<RequestApproval> {
    constructor(@InjectRepository(RequestApproval) readonly repository: Repository<RequestApproval>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
