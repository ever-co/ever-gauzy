import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IsNull } from 'typeorm';
import {
	ICustomizableEmailTemplate,
	LanguagesEnum,
	EmailTemplateEnum,
	IEmailTemplate
} from '@gauzy/contracts';
import { RequestContext } from './../../../core/context';
import { EmailTemplate } from './../../email-template.entity';
import { EmailTemplateService } from '../../email-template.service';
import { EmailTemplateReaderService } from './../../email-template-reader.service';
import { FindEmailTemplateQuery } from '../email-template.find.query';

@QueryHandler(FindEmailTemplateQuery)
export class FindEmailTemplateHandler implements IQueryHandler<FindEmailTemplateQuery> {

	constructor(
		private readonly emailTemplateService: EmailTemplateService,
		private readonly emailTemplateReaderService: EmailTemplateReaderService,
	) { }

	public async execute(
		command: FindEmailTemplateQuery
	): Promise<ICustomizableEmailTemplate> {

		const { input, themeLanguage } = command;
		const { name, organizationId, languageCode = themeLanguage } = input;
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
		name: EmailTemplateEnum,
		organizationId: string,
		tenantId: string,
		type: 'html' | 'subject'
	): Promise<string> {
		let subject = '';
		let template = '';

		try {
			// Find customized email template for given organization
			const { hbs, mjml } = await this.emailTemplateService.findOneByWhereOptions({
				languageCode,
				name: `${name}/${type}`,
				organizationId,
				tenantId
			});
			subject = hbs;
			template = mjml;
		} catch (error) {
			// If no email template present for given organization, use default email template
			const { success, record } = await this.emailTemplateService.findOneOrFailByWhereOptions({
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
					const { hbs, mjml } = await this.emailTemplateService.findOneByWhereOptions({
						languageCode: LanguagesEnum.ENGLISH,
						name: `${name}/${type}`,
						organizationId,
						tenantId
					});
					subject = hbs;
					template = mjml;
				} catch (error) {
					try {
						const { hbs, mjml } = await this.emailTemplateService.findOneByWhereOptions({
							languageCode: LanguagesEnum.ENGLISH,
							name: `${name}/${type}`,
							organizationId: IsNull(),
							tenantId: IsNull()
						});
						subject = hbs;
						template = mjml;
					} catch (error) {
						/**
						 * Fetch missing templates for production environment
						 * Save it to the database for global tenant
						 */
						const templates = this.emailTemplateReaderService.readEmailTemplate(name);
						const emailTemplates = templates.filter(
							(template: IEmailTemplate) => template.name === `${name}/${type}`
						).map(
							(template) => new EmailTemplate({ ...template })
						);
						for await (const emailTemplate of emailTemplates) {
							await this.emailTemplateService.saveTemplate(
								emailTemplate.languageCode as LanguagesEnum,
								name,
								type,
								null,
								null,
								emailTemplate
							);
						}
						const { hbs, mjml } = await this.emailTemplateService.findOneByWhereOptions({
							languageCode,
							name: `${name}/${type}`,
							organizationId: IsNull(),
							tenantId: IsNull()
						});
						subject = hbs;
						template = mjml;
					}
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
