import { IQuery } from '@nestjs/cqrs';

export class EmailTemplateGeneratePreviewQuery implements IQuery {
	static readonly type = '[EmailTemplate] GeneratePreview';

	constructor(public readonly input: string) {}
}
