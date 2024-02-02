import { Repository } from 'typeorm';
import { AccountingTemplate } from '../accounting-template.entity';

export class TypeOrmAccountingTemplateRepository extends Repository<AccountingTemplate> { }