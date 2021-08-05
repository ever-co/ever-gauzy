import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { EmailTemplateService } from '../../email-template.service';
import { FindEmailTemplateQuery } from '../email-template.find.query';
import {
	ICustomizableEmailTemplate,
	LanguagesEnum,
	EmailTemplateNameEnum
} from '@gauzy/contracts';
import { IsNull } from 'typeorm';
import { RequestContext } from './../../../core/context';

@QueryHandler(FindEmailTemplateQuery)
export class FindEmailTemplateHandler
	implements IQueryHandler<FindEmailTemplateQuery> {
	constructor(private readonly emailTemplateService: EmailTemplateService) {}

	public async execute(
		command: FindEmailTemplateQuery
	): Promise<ICustomizableEmailTemplate> {
		const { input, languageCode } = command;
		const { name, organizationId } = input;
		const tenantId = RequestContext.currentTenantId();

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
			const { success, record } = await this.emailTemplateService.findOneOrFail({
				languageCode,
				name: `${name}/${type}`,
				organizationId: IsNull(),
				tenantId: IsNull()
			});
			if (success) {
				subject = record.hbs;
				template = record.mjml;
			} else {
				try {
					const { hbs, mjml } = await this.emailTemplateService.findOne({
						languageCode: LanguagesEnum.ENGLISH,
						name: `${name}/${type}`,
						organizationId,
						tenantId
					});
					subject = hbs;
					template = mjml;
				} catch (error) {
					const { hbs, mjml } = await this.emailTemplateService.findOne({
						languageCode: LanguagesEnum.ENGLISH,
						name: `${name}/${type}`,
						organizationId: IsNull(),
						tenantId: IsNull()
					});
					subject = hbs;
					template = mjml;
				}
			}
		}

		switch (type) {
			case 'subject':
				return subject;
			case 'html':
				return template;
		}
	}
}
