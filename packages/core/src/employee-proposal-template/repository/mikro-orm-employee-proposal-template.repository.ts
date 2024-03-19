import { EntityRepository } from '@mikro-orm/knex';
import { EmployeeProposalTemplate } from '../employee-proposal-template.entity';

export class MikroOrmEmployeeProposalTemplateRepository extends EntityRepository<EmployeeProposalTemplate> { }
