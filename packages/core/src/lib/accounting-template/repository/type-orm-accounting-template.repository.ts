import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccountingTemplate } from '../accounting-template.entity';

@Injectable()
export class TypeOrmAccountingTemplateRepository extends Repository<AccountingTemplate> {
    constructor(@InjectRepository(AccountingTemplate) readonly repository: Repository<AccountingTemplate>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
