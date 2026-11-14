// cspell:ignore cancle -- `cancleAppointmentUrl` is the name the appointment templates read
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import * as Handlebars from 'handlebars';
import { ConfigService, environment } from '@gauzy/config';
import { generateAlphaNumericCode } from '@gauzy/utils';
import { EmailTemplateGeneratePreviewQuery } from '../email-template.generate-preview.query';
import { moment } from '../../../core/moment-extend';
import { compileMjml, toTemplateSource } from '../../compile-mjml';

@QueryHandler(EmailTemplateGeneratePreviewQuery)
export class EmailTemplateGeneratePreviewHandler implements IQueryHandler<EmailTemplateGeneratePreviewQuery> {
	constructor(private readonly configService: ConfigService) {}

	public async execute(command: EmailTemplateGeneratePreviewQuery): Promise<{ html: string }> {
		// Coerce first: both the MJML compiler and the Handlebars fallback below must only ever see a
		// string — Handlebars.compile() also accepts a pre-parsed AST object (GHSA-48h9-vwf5-h8m7).
		const input = toTemplateSource(command.input);
		let textToHtml = input;

		try {
			const mjmlToHtml = await compileMjml(input);
			textToHtml = mjmlToHtml.errors.length ? input : mjmlToHtml.html;
		} catch (error) {
			// ignore mjml conversion errors for non-mjml text such as subject
		}

		const clientBaseUrl = this.configService.get('clientBaseUrl');
		const host = this.configService.get('host');
		const { appName, appLogo, appSignature, appLink, companyLink, companyName } = environment.appIntegrationConfig;
		// Where a sample button or link of the preview leads: this deployment's own front end.
		const sampleLink = clientBaseUrl || host;

		const handlebarsTemplate = Handlebars.compile(textToHtml);
		const html = handlebarsTemplate({
			...this.samplesOfConditionalParts(sampleLink),
			organizationName: 'Organization',
			email: 'user@domain.com',
			name: 'John Doe',
			role: 'USER_ROLE',
			host: clientBaseUrl || host,
			hostEmail: '(host@example.com)',
			agenda: 'This booking is for gauzy call',
			description: 'This is a test appointment booking',
			participantEmails: 'participant@example.com,guest@example.com',
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
			task_update_assign_by: 'Jane Doe',
			task_update_url: 'https://github.com/ever-co/ever-gauzy/issues/1688',
			inviteCode: generateAlphaNumericCode(),
			teams: 'Gauzy Team',
			verificationCode: generateAlphaNumericCode(),
			appName: appName,
			appLogo: appLogo,
			appSignature: appSignature,
			appLink: appLink,
			items: [
				{
					tenantName: 'Default',
					userName: 'Default',
					resetLink: 'https://github.com/ever-co/ever-gauzy',
					// The same list previews the Inbox digest, whose entries read these.
					kindLabel: 'Mention',
					title: 'John Doe mentioned you in a task',
					body: 'Can you review this before the release?',
					link: sampleLink
				}
			],
			companyLink,
			companyName
		});
		return { html };
	}

	/**
	 * Sample values for the parts a template shows only when their variable has a value (a sign-in or invitation
	 * link and its button, a one-time code, an optional name) and for the variables only one template reads. Without
	 * them the preview of those templates had an empty code box and no button at all.
	 *
	 * @param link Where the sample buttons and links lead.
	 * @returns The sample locals.
	 */
	private samplesOfConditionalParts(link: string): Record<string, unknown> {
		return {
			// Sign-in, verification, password and account emails
			magicCode: generateAlphaNumericCode(),
			magicLink: link,
			verificationLink: link,
			generatedUrl: link,
			userName: 'John Doe',
			tenantName: 'Default',
			deletionLink: link,
			expiresInMinutes: 30,
			accounts: 1,
			workspacesDeleted: 0,
			allAccounts: true,
			multipleAccounts: false,
			workspace: 'Default',
			// Invitations and teams
			inviteLink: link,
			code: generateAlphaNumericCode(),
			fullName: 'John Doe',
			employeeName: 'Alex',
			// Invoices, estimates and payments
			acceptUrl: link,
			rejectUrl: link,
			contactName: 'John Doe',
			invoiceNumber: 1,
			amount: 100,
			// Appointments, hiring and timesheets
			emails: 'participant@example.com, guest@example.com',
			rescheduleAppointment: link,
			cancleAppointmentUrl: link,
			jobTitle: 'Software Engineer',
			source: 'Web Timer',
			// Inbox notification and digest
			kindLabel: 'Mention',
			title: 'John Doe mentioned you in a task',
			body: 'Can you review this before the release?',
			link,
			count: 1,
			plural: false,
			more: 0,
			inboxLink: link,
			settingsLink: link
		};
	}
}
