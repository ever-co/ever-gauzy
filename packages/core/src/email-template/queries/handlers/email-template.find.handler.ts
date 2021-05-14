import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { EmailTemplateService } from '../../email-template.service';
import { FindEmailTemplateQuery } from '../email-template.find.query';
import {
	ICustomizableEmailTemplate,
	LanguagesEnum,
	EmailTemplateNameEnum
} from '@gauzy/contracts';
import { IsNull } from 'typeorm';

@QueryHandler(FindEmailTemplateQuery)
export class FindEmailTemplateHandler
	implements IQueryHandler<FindEmailTemplateQuery> {
	constructor(private readonly emailTemplateService: EmailTemplateService) {}

	public async execute(
		command: FindEmailTemplateQuery
	): Promise<ICustomizableEmailTemplate> {
		const {
			input: { languageCode, name, organizationId, tenantId }
		} = command;

		const emailTemplate: ICustomizableEmailTemplate = {
			subject: '',
			template: ''
		};

		[emailTemplate.subject, emailTemplate.template] = await Promise.all([
			await this._fetchTemplate(
				languageCode,
				name,
				organizationId,
				tenantId,
				'subject'
			),
			await this._fetchTemplate(
				languageCode,
				name,
				organizationId,
				tenantId,
				'html'
			)
		]);

		return emailTemplate;
	}

	private async _fetchTemplate(
		languageCode: LanguagesEnum,
		name: EmailTemplateNameEnum,
		organizationId: string,
		tenantId: string,
		type: 'html' | 'subject'
	): Promise<string> {
		let subject = '';
		let template = '';

		try {
			// Find customized email template for given organization
			const { hbs, mjml } = await this.emailTemplateService.findOne({
				languageCode,
				name: `${name}/${type}`,
				organizationId,
				tenantId
			});
			subject = hbs;
			template = mjml;
		} catch (error) {
			// If no email template present for given organization, use default email template
			const { hbs, mjml } = await this.emailTemplateService.findOne({
				languageCode,
				name: `${name}/${type}`,
				organizationId: IsNull(),
				tenantId: IsNull()
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
