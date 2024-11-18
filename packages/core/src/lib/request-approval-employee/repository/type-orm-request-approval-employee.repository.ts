import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequestApprovalEmployee } from '../request-approval-employee.entity';

@Injectable()
export class TypeOrmRequestApprovalEmployeeRepository extends Repository<RequestApprovalEmployee> {
    constructor(@InjectRepository(RequestApprovalEmployee) readonly repository: Repository<RequestApprovalEmployee>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
