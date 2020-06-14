import { ICustomizeEmailTemplateFindInput } from '@gauzy/models';
import { IQuery } from '@nestjs/cqrs';

export class FindEmailTemplateQuery implements IQuery {
	static readonly type = '[EmailTemplate] Find';

	constructor(public readonly input: ICustomizeEmailTemplateFindInput) {}
}
