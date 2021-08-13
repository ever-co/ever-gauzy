
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IAccountingTemplate, IListQueryInput } from '@gauzy/contracts';
import { AccountingTemplateService } from '../../accounting-template.service';
import { AccountingTemplateQuery } from '../accounting-template.query';

@QueryHandler(AccountingTemplateQuery)
export class AccoutingTemplateHandler 
    implements IQueryHandler<AccountingTemplateQuery> {
	
    constructor(
        private readonly accountingTemplateService: AccountingTemplateService
    ) {}

    async execute(query: AccountingTemplateQuery) {
        const { input } = query;
        return await this.accountingTemplateService.findAll(
            input as IListQueryInput<IAccountingTemplate>
        );
    }
}

