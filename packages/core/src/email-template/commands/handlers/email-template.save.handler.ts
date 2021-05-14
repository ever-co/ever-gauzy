import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EmailTemplateSaveCommand } from '../email-template.save.command';
import { EmailTemplateService } from '../../email-template.service';
import { EmailTemplate } from '../../email-template.entity';
import { LanguagesEnum, EmailTemplateNameEnum, IEmailTemplate } from '@gauzy/contracts';
import * as mjml2html from 'mjml';
import { BadRequestException } from '@nestjs/common';

@CommandHandler(EmailTemplateSaveCommand)
export class EmailTemplateSaveHandler
	implements ICommandHandler<EmailTemplateSaveCommand> {
	constructor(private readonly emailTemplateService: EmailTemplateService) {}

	public async execute(
		command: EmailTemplateSaveCommand
	): Promise<IEmailTemplate> {
		const {
			input: {
				languageCode,
				name,
				organizationId,
				tenantId,
				mjml,
				subject
			}
		} = command;

		try {
			await this._saveTemplate(
				languageCode,
				name,
				organizationId,
				tenantId,
				mjml,
				'html'
			);
		} catch (error) {
			// TODO add translation
			throw new BadRequestException('Invalid html template');
		}

		return this._saveTemplate(
			languageCode,
			name,
			organizationId,
			tenantId,
			subject,
			'subject'
		);
	}

	private async _saveTemplate(
		languageCode: LanguagesEnum,
		name: EmailTemplateNameEnum,
		organizationId: string,
		tenantId: string,
		content: string,
		type: 'html' | 'subject'
	): Promise<IEmailTemplate> {
		const {
			success: found,
			record
		}: {
			success: boolean;
			record?: EmailTemplate;
		} = await this.emailTemplateService.findOneOrFail({
			languageCode,
			name: `${name}/${type}`,
			organizationId,
			tenantId
		});

		let entity: IEmailTemplate;
		if (found) {
			switch (type) {
				case 'subject':
					entity = {
						...record,
						hbs: content
					};
					break;
				case 'html':
					entity = {
						...record,
						mjml: content,
						hbs: mjml2html(content).html
					};
					break;
			}
			await this.emailTemplateService.update(record.id, entity);
		} else {
			entity = new EmailTemplate();
			entity.organizationId = organizationId;
			entity.tenantId = tenantId;
			entity.languageCode = languageCode;
			entity.name = `${name}/${type}`;
			switch (type) {
				case 'subject':
					entity.hbs = content;
					break;
				case 'html':
					entity.mjml = content;
					entity.hbs = mjml2html(content).html;
					break;
			}
			await this.emailTemplateService.create(entity);
		}
		return entity;
	}
}
