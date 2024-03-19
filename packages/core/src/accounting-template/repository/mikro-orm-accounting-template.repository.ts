import { EntityRepository } from '@mikro-orm/knex';
import { AccountingTemplate } from '../accounting-template.entity';

export class MikroOrmAccountingTemplateRepository extends EntityRepository<AccountingTemplate> { }
