import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { IsNull } from 'typeorm';
import * as Handlebars from 'handlebars';
import { IEmailTemplate, IVerifySMTPTransport, LanguagesEnum } from '@gauzy/contracts';
import { ISMTPConfig } from '@gauzy/common';
import { isEmpty } from '@gauzy/utils';
import { CustomSmtp } from '../core/entities/internal';
import { SMTPUtils } from './utils';
import { TypeOrmEmailTemplateRepository } from './../email-template/repository/type-orm-email-template.repository';
import { TypeOrmCustomSmtpRepository } from './../custom-smtp/repository/type-orm-custom-smtp.repository';
import { toTemplateSource } from './../email-template/compile-mjml';

/**
 * The languages to try, in order, without repeating one.
 */
function uniqueLanguages(...languages: string[]): string[] {
	return languages.filter((language, index) => !!language && languages.indexOf(language) === index);
}

@Injectable()
export class EmailTemplateRenderService {
	private readonly logger = new Logger(EmailTemplateRenderService.name);

	constructor(
		private typeOrmEmailTemplateRepository: TypeOrmEmailTemplateRepository,
		private typeOrmCustomSmtpRepository: TypeOrmCustomSmtpRepository
	) {}

	/**
	 * Renders an email template based on the provided view and locals.
	 * @param view The name of the email template to render.
	 * @param locals Local variables to be used in the template rendering.
	 * @returns The rendered HTML content of the email template.
	 */
	public render = async (view: string, locals: any) => {
		let smtpTransporter: CustomSmtp;
		let isValidSmtp: boolean = false;

		try {
			smtpTransporter = await this.typeOrmCustomSmtpRepository.findOneOrFail({
				where: {
					organizationId: isEmpty(locals.organizationId) ? IsNull() : locals.organizationId,
					tenantId: isEmpty(locals.tenantId) ? IsNull() : locals.tenantId
				},
				order: {
					createdAt: 'DESC'
				}
			});
		} catch (error) {
			smtpTransporter = await this.typeOrmCustomSmtpRepository.findOne({
				where: {
					organizationId: IsNull(),
					tenantId: isEmpty(locals.tenantId) ? IsNull() : locals.tenantId
				},
				order: {
					createdAt: 'DESC'
				}
			});
		}

		if (smtpTransporter) {
			/** */
			try {
				const smtpConfig: ISMTPConfig = smtpTransporter.getSmtpTransporter();
				const transport: IVerifySMTPTransport = SMTPUtils.convertSmtpToTransporter(smtpConfig);

				isValidSmtp = !!(await SMTPUtils.verifyTransporter(transport));
			} catch (error) {
				isValidSmtp = false;
			}
		}

		try {
			view = view.replaceAll('\\', '/');

			const requestedLanguage: string = locals.locale || LanguagesEnum.ENGLISH;

			// The recipient's language first, then English. Most templates ship in only a handful of
			// languages (email-verification: en, bg, he, ru), and a locale without one used to render
			// '' for every part — so a Spanish, Portuguese or Chinese user got no verification email at
			// all. English is the language every template is seeded in.
			let emailTemplate: IEmailTemplate | null = null;
			for (const languageCode of uniqueLanguages(requestedLanguage, LanguagesEnum.ENGLISH)) {
				emailTemplate = await this.findTemplate(view, languageCode, locals, isValidSmtp);
				if (emailTemplate) {
					if (languageCode !== requestedLanguage) {
						this.logger.warn(
							`Email template "${view}" has no "${requestedLanguage}" version; rendering "${languageCode}" instead.`
						);
					}
					break;
				}
			}

			if (!emailTemplate) {
				return '';
			}

			// `hbs` is tenant-editable; Handlebars.compile() must only ever get a string, never an AST
			// object (GHSA-48h9-vwf5-h8m7).
			const template = Handlebars.compile(toTemplateSource(emailTemplate.hbs));
			const html = template(locals);
			return html;
		} catch (error) {
			console.log('Error while rendering email template: %s', error);
			throw new InternalServerErrorException(error);
		}
	};

	/**
	 * One template in one language: the organization's / tenant's own copy when its SMTP is valid,
	 * otherwise (or when it has none) the global default.
	 *
	 * @param view The template view, e.g. `email-verification/html`.
	 * @param languageCode The language to look up.
	 * @param locals The render locals (read for `organizationId` / `tenantId`).
	 * @param isValidSmtp Whether the tenant's custom SMTP verified, which is what enables its templates.
	 */
	private async findTemplate(
		view: string,
		languageCode: string,
		locals: any,
		isValidSmtp: boolean
	): Promise<IEmailTemplate | null> {
		if (isValidSmtp) {
			// Same NULL handling as the SMTP lookup in render(): a missing organization / tenant selects
			// the tenant-wide / global row, never "any organization's" template.
			const custom = await this.typeOrmEmailTemplateRepository.findOneBy({
				name: view,
				languageCode: languageCode as LanguagesEnum,
				organizationId: isEmpty(locals.organizationId) ? IsNull() : locals.organizationId,
				tenantId: isEmpty(locals.tenantId) ? IsNull() : locals.tenantId
			});
			if (custom) {
				return custom;
			}
		}

		// The default template.
		return await this.typeOrmEmailTemplateRepository.findOneBy({
			name: view,
			languageCode: languageCode as LanguagesEnum,
			organizationId: IsNull(),
			tenantId: IsNull()
		});
	}
}
