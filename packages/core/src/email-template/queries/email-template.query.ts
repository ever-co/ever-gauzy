import { IEmailTemplate } from '@gauzy/contracts';
import { IQuery } from '@nestjs/cqrs';
import { PaginationParams } from './../../core/crud/pagination-params';

export class EmailTemplateQuery implements IQuery {
	static readonly type = '[Email Template] Query All';

	constructor(
		public readonly input: PaginationParams<IEmailTemplate>,
	) {}
}