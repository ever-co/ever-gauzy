import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { EmployeeProposalTemplate } from '../employee-proposal-template.entity';

@Injectable()
export class TypeOrmEmployeeProposalTemplateRepository extends Repository<EmployeeProposalTemplate> {
    constructor(@InjectRepository(EmployeeProposalTemplate) readonly repository: Repository<EmployeeProposalTemplate>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
