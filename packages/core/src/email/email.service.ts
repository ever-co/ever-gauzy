import {
	IEmailTemplate,
	IInviteEmployeeModel,
	IInviteUserModel,
	IOrganization,
	IOrganizationContact,
	LanguagesEnum
} from '@gauzy/contracts';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as Email from 'email-templates';
import * as Handlebars from 'handlebars';
import * as nodemailer from 'nodemailer';
import { Repository, IsNull } from 'typeorm';
import { environment as env } from '@gauzy/config';
import { ISMTPConfig } from '@gauzy/common';
import { CrudService } from '../core';
import { EmailTemplate } from '../email-template/email-template.entity';
import { Organization } from '../organization/organization.entity';
import { User } from '../user/user.entity';
import { Email as IEmail } from './email.entity';
import { Invite } from '../invite/invite.entity';
import { Timesheet } from '../timesheet/timesheet.entity';
import { RequestContext } from '../core/context';

@Injectable()
export class EmailService extends CrudService<IEmail> {

	private readonly email: Email;

	constructor(
		@InjectRepository(IEmail)
		private readonly emailRepository: Repository<IEmail>,

		@InjectRepository(EmailTemplate)
		private readonly emailTemplateRepository: Repository<EmailTemplate>,

		@InjectRepository(Organization)
		private readonly organizationRepository: Repository<Organization>
	) {
		super(emailRepository);
		const config: Email.EmailConfig<any> = {
			message: {
				from: env.smtpConfig.from || 'gauzy@ever.co'
			},

			// if you want to send emails in development or test environments, set options.send to true.
			send: true,
			transport: this.createSMTPTransporter(),
			i18n: {},
			views: {
				options: {
					extension: 'hbs'
				}
			},
			render: this.render
		};

		if (!env.production) {
			config.preview = {
				open: {
					app: 'firefox',
					wait: false
				}
			};
		}

		this.email = new Email(config);
	}

	private render = (view, locals) => {
		return new Promise(async (resolve, reject) => {
			view = view.replace('\\', '/');

			// Find email template for customized for given organization
			let emailTemplate: IEmailTemplate = await this.emailTemplateRepository.findOne({
				name: view,
				languageCode: locals.locale || LanguagesEnum.ENGLISH,
				organizationId: locals.organizationId,
				tenantId: locals.tenantId
			});

			// if no email template present for given organization, use default email template
			if (!emailTemplate) {
				emailTemplate = await this.emailTemplateRepository.findOne({
					name: view,
					languageCode: locals.locale || LanguagesEnum.ENGLISH,
					organizationId: IsNull(),
					tenantId: IsNull()
				});
			}

			if (!emailTemplate) {
				return resolve('');
			}

			const template = Handlebars.compile(emailTemplate.hbs);
			const html = template(locals);
			return resolve(html);
		});
	};

	async sendPaymentReceipt(
		languageCode: LanguagesEnum,
		email: string,
		contactName: string,
		invoiceNumber: number,
		amount: number,
		currency: string,
		organization: IOrganization,
		originUrl: string
	) {
		const tenantId = RequestContext.currentTenantId();
		const { id: organizationId, name: organizationName } = organization;
		const sendOptions = {
			template: 'payment-receipt',
			message: {
				to: `${email}`
			},
			locals: {
				locale: languageCode,
				host: originUrl || env.host,
				contactName,
				invoiceNumber,
				amount,
				currency,
				organizationId,
				tenantId,
				organizationName
			}
		}
		this.email
			.send(sendOptions)
			.then((res) => {
				this.createEmailRecord({
					templateName: sendOptions.template,
					email,
					languageCode,
					organization,
					message: res.originalMessage
				});
			})
			.catch(console.error);
	}

	emailInvoice(
		languageCode: LanguagesEnum,
		email: string,
		base64: string,
		invoiceNumber: number,
		invoiceId: string,
		isEstimate: boolean,
		token: any,
		originUrl: string,
		organization: IOrganization
	) {
		const tenantId = RequestContext.currentTenantId();
		const { id: organizationId } = organization;
		const baseUrl = originUrl || env.host;
		const sendOptions = {
			template: isEstimate ? 'email-estimate' : 'email-invoice',
			message: {
				to: `${email}`,
				attachments: [
					{
						filename: `${ isEstimate ? 'Estimate' : 'Invoice' }-${invoiceNumber}.pdf`,
						content: base64,
						encoding: 'base64'
					}
				]
			},
			locals: {
				tenantId,
				organizationId,
				locale: languageCode,
				host: baseUrl,
				acceptUrl: `${baseUrl}#/auth/estimate/?token=${token}&id=${invoiceId}&action=accept&email=${email}`, 
				rejectUrl: `${baseUrl}#/auth/estimate/?token=${token}&id=${invoiceId}&action=reject&email=${email}`
			}
		};
		
		this.email
			.send(sendOptions)
			.then((res) => {
				this.createEmailRecord({
					templateName: sendOptions.template,
					email,
					languageCode,
					organization,
					message: res.originalMessage
				});
			})
			.catch(console.error);
	}

	inviteOrganizationContact(
		organizationContact: IOrganizationContact,
		inviterUser: User,
		organization: Organization,
		invite: Invite,
		languageCode: LanguagesEnum,
		originUrl?: string
	) {
		const tenantId = RequestContext.currentTenantId();
		const { id: organizationId } = organization;
		const baseUrl = originUrl || env.host;
		const sendOptions = {
			template: 'invite-organization-client',
			message: {
				to: `${organizationContact.primaryEmail}`
			},
			locals: {
				locale: languageCode,
				name: organizationContact.name,
				host: baseUrl,
				id: organizationContact.id,
				inviterName: inviterUser ? (inviterUser.name || '') : '',
				organizationName: organization.name,
				organizationId,
				tenantId,
				generatedUrl: `${baseUrl}#/auth/accept-client-invite?email=${organizationContact.primaryEmail}&token=${invite.token}`
			}
		};

		this.email
			.send(sendOptions)
			.then((res) => {
				this.createEmailRecord({
					templateName: sendOptions.template,
					email: organizationContact.primaryEmail,
					languageCode,
					message: res.originalMessage,
					organization
				});
			})
			.catch(console.error);
	}

	inviteUser(inviteUserModel: IInviteUserModel) {
		const {
			email,
			role,
			organization,
			registerUrl,
			originUrl,
			languageCode,
			invitedBy
		} = inviteUserModel;
		const tenantId = RequestContext.currentTenantId();
		const { id: organizationId } = organization;
		const sendOptions = {
			template: 'invite-user',
			message: {
				to: `${email}`
			},
			locals: {
				locale: languageCode,
				role: role,
				organizationName: organization.name,
				organizationId,
				tenantId,
				generatedUrl: registerUrl,
				host: originUrl || env.host
			}
		};
		this.email
			.send(sendOptions)
			.then((res) => {
				this.createEmailRecord({
					templateName: sendOptions.template,
					email,
					languageCode,
					message: res.originalMessage,
					organization,
					user: invitedBy
				});
			})
			.catch(console.error);
	}

	inviteEmployee(inviteEmployeeModel: IInviteEmployeeModel) {
		const { email, registerUrl, projects, organization, originUrl, languageCode, invitedBy } = inviteEmployeeModel;
		const tenantId = RequestContext.currentTenantId();
		const { id: organizationId } = organization;

		const sendOptions = {
			template: 'invite-employee',
			message: {
				to: `${email}`
			},
			locals: {
				locale: languageCode,
				role: projects,
				organizationName: organization.name,
				organizationId,
				tenantId,
				generatedUrl: registerUrl,
				host: originUrl || env.host
			}
		};
		this.email
			.send(sendOptions)
			.then((res) => {
				this.createEmailRecord({
					templateName: sendOptions.template,
					email,
					languageCode,
					message: res.originalMessage,
					organization,
					user: invitedBy
				});
			})
			.catch(console.error);
	}

	async welcomeUser(
		user: User,
		languageCode: LanguagesEnum,
		organizationId?: string,
		originUrl?: string
	) {
		const tenantId = RequestContext.currentTenantId();
		const sendOptions = {
			template: 'welcome-user',
			message: {
				to: `${user.email}`
			},
			locals: {
				locale: languageCode,
				email: user.email,
				host: originUrl || env.host,
				organizationId: organizationId || IsNull(),
				tenantId: tenantId || IsNull()
			}
		};

		let organization: Organization;
		if (organizationId) {
			organization = await this.organizationRepository.findOne(
				organizationId
			);
		}
		this.email
			.send(sendOptions)
			.then((res) => {
				this.createEmailRecord({
					templateName: sendOptions.template,
					email: user.email,
					languageCode,
					organization,
					message: res.originalMessage,
				});
			})
			.catch(console.error);
	}

	async requestPassword(
		user: User,
		url: string,
		languageCode: LanguagesEnum,
		organizationId: string,
		originUrl?: string
	) {
		const tenantId = RequestContext.currentTenantId();
		const sendOptions = {
			template: 'password',
			message: {
				to: `${user.email}`,
				subject: 'Forgotten Password'
			},
			locals: {
				locale: languageCode,
				generatedUrl: url,
				host: originUrl || env.host,
				organizationId,
				tenantId
			}
		};

		const organization = await this.organizationRepository.findOne(
			organizationId
		);
		this.email
			.send(sendOptions)
			.then((res) => {
				this.createEmailRecord({
					templateName: sendOptions.template,
					email: user.email,
					languageCode,
					organization,
					message: res.originalMessage
				});
			})
			.catch(console.error);
	}

	async sendAppointmentMail(
		email: string,
		languageCode: LanguagesEnum,
		organizationId?: string,
		originUrl?: string
	) {
		const tenantId = RequestContext.currentTenantId();
		const sendOptions = {
			template: 'email-appointment',
			message: {
				to: email
			},
			locals: {
				locale: languageCode,
				email: email,
				host: originUrl || env.host,
				organizationId: organizationId || IsNull(),
				tenantId: tenantId || IsNull()
			}
		};

		let organization: Organization;
		if (organizationId) {
			organization = await this.organizationRepository.findOne(
				organizationId
			);
		}

		this.email
			.send(sendOptions)
			.then((res) => {
				this.createEmailRecord({
					templateName: sendOptions.template,
					email: email,
					languageCode,
					organization,
					message: res.originalMessage
				});
			})
			.catch(console.error);
	}

	async setTimesheetAction(email: string, timesheet: Timesheet) {
		const languageCode = RequestContext.getLanguageCode();
		const tenantId = RequestContext.currentTenantId();
		const organizationId = timesheet.employee.organizationId;
		const sendOptions = {
			template: 'timesheet-action',
			message: {
				to: email
			},
			locals: {
				locale: languageCode,
				email: email,
				host: env.host,
				timesheet: timesheet,
				timesheet_action: timesheet.status,
				organizationId,
				tenantId
			}
		};

		const organization = await this.organizationRepository.findOne(
			timesheet.employee.organizationId
		);
		this.email
			.send(sendOptions)
			.then((res) => {
				this.createEmailRecord({
					templateName: sendOptions.template,
					email: email,
					languageCode,
					message: res.originalMessage,
					organization,
					user: timesheet.employee.user
				});
			})
			.catch(console.error);
	}

	async timesheetSubmit(email: string, timesheet: Timesheet) {
		const languageCode = RequestContext.getLanguageCode();
		const tenantId = RequestContext.currentTenantId();
		const organizationId = timesheet.employee.organizationId;
		const sendOptions = {
			template: 'timesheet-submit',
			message: {
				to: email
			},
			locals: {
				locale: languageCode,
				email: email,
				host: env.host,
				timesheet: timesheet,
				timesheet_action: timesheet.status,
				organizationId,
				tenantId
			}
		};

		const organization = await this.organizationRepository.findOne(
			timesheet.employee.organizationId
		);

		this.email
			.send(sendOptions)
			.then((res) => {
				this.createEmailRecord({
					templateName: sendOptions.template,
					email: email,
					languageCode,
					message: res.originalMessage,
					organization,
					user: timesheet.employee.user
				});
			})
			.catch(console.error);
	}

	private async createEmailRecord(createEmailOptions: {
		templateName: string;
		email: string;
		languageCode: LanguagesEnum;
		message: any;
		organization?: Organization;
		user?: User;
	}): Promise<IEmail> {
		const emailEntity = new IEmail();
		const tenantId = RequestContext.currentTenantId();
		const {
			templateName: template,
			email,
			languageCode,
			message,
			organization,
			user
		} = createEmailOptions;

		const emailTemplate = await this.emailTemplateRepository.findOne({
			name: template + '/html',
			languageCode
		});
		emailEntity.name = message.subject;
		emailEntity.email = email;
		emailEntity.content = message.html;
		emailEntity.emailTemplate = emailTemplate;
		emailEntity.tenantId = tenantId;
		emailEntity.organizationId = (organization) ? organization.id : null;

		if (user) {
			emailEntity.user = user;
		}

		return this.emailRepository.save(emailEntity);
	}

	/*
	 * This example would connect to a SMTP server separately for every single message
	 */
	public createSMTPTransporter() {
		const smtp: ISMTPConfig = env.smtpConfig;
		return {
			host: smtp.host,
			port: smtp.port,
			secure: smtp.secure, // true for 465, false for other ports
			auth: {
				user: smtp.auth.user,
				pass: smtp.auth.pass
			}
		};
	}

	// tested e-mail send functionality
	private async nodemailerSendEmail(user: User, url: string) {
		const testAccount = await nodemailer.createTestAccount();

		const transporter = nodemailer.createTransport({
			host: 'smtp.ethereal.email',
			port: 587,
			secure: false, // true for 465, false for other ports
			auth: {
				user: testAccount.user,
				pass: testAccount.pass
			}
		});

		// Gmail example:

		// const transporter = nodemailer.createTransport({
		// 	service: 'gmail',
		// 	auth: {
		// 		user: 'user@gmail.com',
		// 		pass: 'password'
		// 	}
		// });

		const info = await transporter.sendMail({
			from: 'Gauzy',
			to: user.email,
			subject: 'Forgotten Password',
			text: 'Forgot Password',
			html:
				'Hello! <br><br> We received a password change request.<br><br>If you requested to reset your password<br><br>' +
				'<a href=' +
				url +
				'>Click here</a>'
		});

		console.log('Message sent: %s', info.messageId);
		console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
	}
}
