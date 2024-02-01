import { EntityRepository } from '@mikro-orm/core';
import { EmployeeProposalTemplate } from '../employee-proposal-template.entity';

export class MikroOrmEmployeeProposalTemplateRepository extends EntityRepository<EmployeeProposalTemplate> { }