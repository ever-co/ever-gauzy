import { Repository } from 'typeorm';
import { EmployeeProposalTemplate } from '../employee-proposal-template.entity';

export class TypeOrmEmployeeProposalTemplateRepository extends Repository<EmployeeProposalTemplate> { }