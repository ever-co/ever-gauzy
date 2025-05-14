import { IQuery } from '@nestjs/cqrs';
import { AccountingTemplate } from './../accounting-template.entity';
import { BaseQueryDTO } from '../../core/crud/pagination-params';

export class AccountingTemplateQuery implements IQuery {
	static readonly type = '[Accounting Template] Query All';

	constructor(public readonly options: BaseQueryDTO<AccountingTemplate>) {}
}
