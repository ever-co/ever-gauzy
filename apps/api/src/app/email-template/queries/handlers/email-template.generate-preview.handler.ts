import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import * as Handlebars from 'handlebars';
import * as mjml2html from 'mjml';
import { EmailTemplateService } from '../../email-template.service';
import { EmailTemplateGeneratePreviewQuery } from '../email-template.generate-preview.query';

@QueryHandler(EmailTemplateGeneratePreviewQuery)
export class EmailTemplateGeneratePreviewHandler
	implements IQueryHandler<EmailTemplateGeneratePreviewQuery> {
	constructor(private readonly emailTemplateService: EmailTemplateService) {}

	public async execute(
		command: EmailTemplateGeneratePreviewQuery
	): Promise<{ html: string }> {
		const { input } = command;
		let textToHtml = input;

		try {
			const mjmlTohtml = mjml2html(input);
			textToHtml = mjmlTohtml.errors.length ? input : mjmlTohtml.html;
		} catch (error) {
			// ignore mjml conversion errors for non-mjml text such as subject
		}

		const handlebarsTemplate = Handlebars.compile(textToHtml);
		const html = handlebarsTemplate({
			organizationName: 'Organization',
			email: 'user@domain.com',
			name: 'John Doe',
			role: 'USER_ROLE',
      host: 'Alish Meklyov',
      hostEmail: '(alish@ever.com)',
      agenda: 'This booking is for gauzy call',
      description: 'This is a test appointment booking',
      participantEmails: 'kdashora@gmail.com,testmail@hotmail.com',
      location: 'zoom.us',
      duration: 'Fri, Jul 24, 2020 6:00 AM - Fri, Jul 24, 2020 6:15 AM',
      candidateName: 'Alex',
      date:'Thursday, August 27, 2020',
      interviewerName:'John Doe',
		});
		return { html };
	}
}
