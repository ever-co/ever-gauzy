import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeeProposalTemplate } from '../employee-proposal-template.entity';

@Injectable()
export class TypeOrmEmployeeProposalTemplateRepository extends Repository<EmployeeProposalTemplate> {
    constructor(@InjectRepository(EmployeeProposalTemplate) readonly repository: Repository<EmployeeProposalTemplate>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
