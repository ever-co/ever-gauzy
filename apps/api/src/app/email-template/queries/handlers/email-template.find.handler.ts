import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { EmailTemplateService } from '../../email-template.service';
import { FindEmailTemplateQuery } from '../email-template.find.query';
import {
	CustomizableEmailTemplate,
	LanguagesEnum,
	EmailTemplateNameEnum,
	EmailTemplate
} from '@gauzy/models';
import { IsNull } from 'typeorm';

@QueryHandler(FindEmailTemplateQuery)
export class FindEmailTemplateHandler
	implements IQueryHandler<FindEmailTemplateQuery> {
	constructor(private readonly emailTemplateService: EmailTemplateService) {}

	public async execute(
		command: FindEmailTemplateQuery
	): Promise<CustomizableEmailTemplate> {
		const {
			input: { languageCode, name, organizationId }
		} = command;

		const emailTemplate: CustomizableEmailTemplate = {
			subject: '',
			template: ''
		};

		[emailTemplate.subject, emailTemplate.template] = await Promise.all([
			this._fetchTemplate(languageCode, name, organizationId, 'subject'),
			this._fetchTemplate(languageCode, name, organizationId, 'html')
		]);

		return emailTemplate;
	}

	private async _fetchTemplate(
		languageCode: LanguagesEnum,
		name: EmailTemplateNameEnum,
		organizationId: string,
		type: 'html' | 'subject'
	): Promise<string> {
		let subject = '';
		let template = '';

		const {
			success,
			record
		}: {
			success: boolean;
			record?: EmailTemplate;
		} = await this.emailTemplateService.findOneOrFail({
			languageCode,
			name: `${name}/${type}`,
			organization: { id: organizationId }
		});

		if (success) {
			subject = record.hbs;
			template = record.mjml;
		} else {
			const { hbs, mjml } = await this.emailTemplateService.findOne({
				languageCode,
				name: `${name}/${type}`,
				organization: IsNull()
			});
			subject = hbs;
			template = mjml;
		}

		switch (type) {
			case 'subject':
				return subject;
			case 'html':
				return template;
		}
	}
}
