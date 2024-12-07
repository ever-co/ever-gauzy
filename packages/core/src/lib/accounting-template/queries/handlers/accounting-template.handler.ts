
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AccountingTemplateService } from '../../accounting-template.service';
import { AccountingTemplateQuery } from '../accounting-template.query';

@QueryHandler(AccountingTemplateQuery)
export class AccountingTemplateHandler
    implements IQueryHandler<AccountingTemplateQuery> {

    constructor(
        private readonly accountingTemplateService: AccountingTemplateService
    ) {}

    async execute(query: AccountingTemplateQuery) {
        const { options } = query;
        return await this.accountingTemplateService.findAll(options);
    }
}
