import { EntityRepository } from '@mikro-orm/core';
import { AccountingTemplate } from '../accounting-template.entity';

export class MikroOrmAccountingTemplateRepository extends EntityRepository<AccountingTemplate> { }