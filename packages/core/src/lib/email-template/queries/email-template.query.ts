import { IQuery } from '@nestjs/cqrs';
import { EmailTemplate } from './../email-template.entity';
import { BaseQueryDTO } from './../../core/crud/pagination-params';

export class EmailTemplateQuery implements IQuery {
	static readonly type = '[Email Template] Query All';

	constructor(public readonly options: BaseQueryDTO<EmailTemplate>) {}
}
