import { IQuery } from '@nestjs/cqrs';
import { PaginationParams } from '@gauzy/core';
import { EmailTemplate } from './../email-template.entity';

export class EmailTemplateQuery implements IQuery {
	static readonly type = '[Email Template] Query All';

	constructor(
		public readonly options: PaginationParams<EmailTemplate>,
	) { }
}
