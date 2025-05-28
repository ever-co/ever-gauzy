import { IQuery } from '@nestjs/cqrs';
import { EmailTemplate } from './../email-template.entity';
import { BaseQueryDTO } from '../../core/dto/base-query.dto';

export class EmailTemplateQuery implements IQuery {
	static readonly type = '[Email Template] Query All';

	constructor(public readonly options: BaseQueryDTO<EmailTemplate>) {}
}
