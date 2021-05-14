import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import * as Handlebars from 'handlebars';
import * as mjml2html from 'mjml';
import { EmailTemplateService } from '../../email-template.service';
import { EmailTemplateGeneratePreviewQuery } from '../email-template.generate-preview.query';
import { moment } from '../../../core/moment-extend';
import { ConfigService } from '@gauzy/config';

@QueryHandler(EmailTemplateGeneratePreviewQuery)
export class EmailTemplateGeneratePreviewHandler
	implements IQueryHandler<EmailTemplateGeneratePreviewQuery> {
	constructor(
		private readonly emailTemplateService: EmailTemplateService,
		private readonly configService: ConfigService
	) {}

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

		const clientBaseUrl = this.configService.get('clientBaseUrl');
		const host = this.configService.get('host');

		const handlebarsTemplate = Handlebars.compile(textToHtml);
		const html = handlebarsTemplate({
			organizationName: 'Organization',
			email: 'user@domain.com',
			name: 'John Doe',
			role: 'USER_ROLE',
			host: clientBaseUrl || host,
			hostEmail: '(alish@ever.com)',
			agenda: 'This booking is for gauzy call',
			description: 'This is a test appointment booking',
			participantEmails: 'kdashora@gmail.com,testmail@hotmail.com',
			location: 'zoom.us',
			duration: 'Fri, Jul 24, 2020 6:00 AM - Fri, Jul 24, 2020 6:15 AM',
			candidateName: 'Alex',
			date: 'Thursday, August 27, 2020',
			interviewerName: 'John Doe',
			total_hours: '16',
			average_activates: '25',
			log_type: 'tracked',
			projects: ['Gauzy Web Site', 'Gauzy Platform(open-source)'],
			project: 'Gauzy Web Site',
			timesheet_action: 'APPROVE/REJECT',
			equipment_status: 'APPROVE/REJECT',
			reason: 'reason for this',
			equipment_name: 'Fiat Freemont',
			equipment_type: 'Car',
			equipment_serial_number: 'CB0950AT',
			manufactured_year: '2015',
			initial_cost: '40000',
			currency: 'BGN',
			max_share_period: '5',
			autoApproveShare: false,
			time_off_policy_requires_approval: 'APPROVE/REJECT',
			time_off_policy_paid_status: true,
			task_update_status: 'Update/Assign',
			task_update_title: 'Bug: Consistency in "Time Off" feature',
			task_update_description:
				'"Time off" should be called "Time Off" everywhere. \n' +
				'Fix "Request Days Off" and change it to just "Request". \n' +
				'Also, check all popups, etc. that it is called "Time Off" (not "Day off" or anything else) everywhere.\n' +
				'\n' +
				'![Artboard](https://user-images.githubusercontent.com/6750734/88939490-33939180-d2a4-11ea-8d13-3efed87a7846.png)\n',
			task_update_estimate: 'estimate',
			task_update_due_date: moment(new Date()).add(10, 'days').toDate(),
			task_status: 'In Progress',
			task_update_project: 'Gauzy Project',
			task_update_assign_by: 'Ruslan Konviser',
			task_update_url: 'https://github.com/ever-co/gauzy/issues/1688'
		});
		return { html };
	}
}
