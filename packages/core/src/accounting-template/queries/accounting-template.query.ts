import { IAccountingTemplate } from '@gauzy/contracts';
import { IQuery } from '@nestjs/cqrs';
import { PaginationParams } from '../../core/crud/pagination-params';

export class AccountingTemplateQuery implements IQuery {
	static readonly type = '[Accounting Template] Query All';

	constructor(
		public readonly input: PaginationParams<IAccountingTemplate>,
	) {}
}