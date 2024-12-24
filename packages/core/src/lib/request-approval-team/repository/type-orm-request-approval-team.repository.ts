import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequestApprovalTeam } from '../request-approval-team.entity';

@Injectable()
export class TypeOrmRequestApprovalTeamRepository extends Repository<RequestApprovalTeam> {
    constructor(@InjectRepository(RequestApprovalTeam) readonly repository: Repository<RequestApprovalTeam>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
