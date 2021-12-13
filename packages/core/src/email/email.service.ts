import {
	IEmailTemplate,
	IInviteEmployeeModel,
	IInviteUserModel,
	IOrganization,
	IOrganizationContact,
	LanguagesEnum,
	IJoinEmployeeModel,
	ITimesheet,
	IEmail,
	IUser,
	IInvite
} from '@gauzy/contracts';
import { forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as Email from 'email-templates';
import * as Handlebars from 'handlebars';
import * as nodemailer from 'nodemailer';
import { Repository, IsNull } from 'typeorm';
import { environment as env } from '@gauzy/config';
import { ISMTPConfig } from '@gauzy/common';
import { TenantAwareCrudService } from './../core/crud';
import { RequestContext } from '../core/context';
import { EmailTemplate, Organization } from './../core/entities/internal';
import { Email as EmailEntity } from './email.entity';
import { CustomSmtpService } from './../custom-smtp/custom-smtp.service';

@Injectable()
export class EmailService extends TenantAwareCrudService<EmailEntity> {

	constructor(
		@InjectRepository(EmailEntity)
		private readonly emailRepository: Repository<EmailEntity>,

		@InjectRepository(EmailTemplate)
		private readonly emailTemplateRepository: Repository<EmailTemplate>,

		@InjectRepository(Organization)
		private readonly organizationRepository: Repository<Organization>,

		@Inject(forwardRef(() => CustomSmtpService))
		private readonly customSmtpService: CustomSmtpService
	) {
		super(emailRepository);	
	}

	/**
	 * GET email instance for tenant/organization
	 * 
	 * @param organizationId 
	 * @param tenantId 
	 * @returns 
	 */
	private async getEmailInstance(
		organizationId?: string,
		tenantId?: string
	): Promise<Email<any>> {
		const currentTenantId = tenantId || RequestContext.currentTenantId();
		let smtpConfig: ISMTPConfig;

		try {
			const smtpTransporter = await this.customSmtpService.findOneByOptions({
				where: {
					tenantId: currentTenantId,
					organizationId
				}
			});
			smtpConfig = smtpTransporter.getSmtpTransporter() as ISMTPConfig;
		} catch (error) {
			try {
				if (error instanceof NotFoundException) {
					const smtpTransporter = await this.customSmtpService.findOneByOptions({
						where: {
							tenantId: currentTenantId,
							organizationId: IsNull()
						}
					});
					smtpConfig = smtpTransporter.getSmtpTransporter() as ISMTPConfig;
				}
			} catch (error) {
				smtpConfig = this.customSmtpService.defaultSMTPTransporter() as ISMTPConfig;
			}
		}

		const config: Email.EmailConfig<any> = {
			message: {
				from: env.smtpConfig.from || 'gauzy@ever.co'
			},

			// if you want to send emails in development or test environments, set options.send to true.
			send: true,
			transport: smtpConfig || this.customSmtpService.defaultSMTPTransporter() as ISMTPConfig,
			i18n: {},
			views: {
				options: {
					extension: 'hbs'
				}
			},
			render: this.render
		};

		/* TODO: uncomment this after we figure out issues with dev / prod in the environment.*.ts 
		if (!env.production && !env.demo) {
			config.preview = {
				open: {
					app: 'firefox',
					wait: false
				}
			};
		}
		*/

		return new Email(config);
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
				host: originUrl || env.clientBaseUrl,
				contactName,
				invoiceNumber,
				amount,
				currency,
				organizationId,
				tenantId,
				organizationName
			}
		}
		await (await this.getEmailInstance(organizationId, tenantId))
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

	async emailInvoice(
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
		const baseUrl = originUrl || env.clientBaseUrl;
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
		
		await (await this.getEmailInstance(organizationId, tenantId))
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

	async inviteOrganizationContact(
		organizationContact: IOrganizationContact,
		inviterUser: IUser,
		organization: IOrganization,
		invite: IInvite,
		languageCode: LanguagesEnum,
		originUrl?: string
	) {
		const tenantId = RequestContext.currentTenantId();
		const { id: organizationId } = organization;
		const baseUrl = originUrl || env.clientBaseUrl;
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

		await (await this.getEmailInstance(organizationId, tenantId))
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

	async inviteUser(inviteUserModel: IInviteUserModel) {
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
				host: originUrl || env.clientBaseUrl
			}
		};
		await (await this.getEmailInstance(organizationId, tenantId))
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

	async inviteEmployee(inviteEmployeeModel: IInviteEmployeeModel) {
		const { 
			email,
			registerUrl,
			projects,
			organization,
			originUrl,
			languageCode,
			invitedBy
		} = inviteEmployeeModel;
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
				host: originUrl || env.clientBaseUrl
			}
		};
		await (await this.getEmailInstance(organizationId, tenantId))
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

	async sendAcceptInvitationEmail(joinEmployeeModel: IJoinEmployeeModel, originUrl?: string) {
		const { 
			email,
			employee,
			organization,
			languageCode,
		} = joinEmployeeModel;

		const sendOptions = {
			template: 'employee-join',
			message: {
				to: `${email}`
			},
			locals: {
				host: originUrl || env.clientBaseUrl,
				locale: languageCode,
				organizationName: organization.name,
				employeeName: employee.user.firstName,
			}
		};
		
		const { id: organizationId } = organization;
		await (await this.getEmailInstance(organizationId))
			.send(sendOptions)
			.then((res) => {
				this.createEmailRecord({
					templateName: sendOptions.template,
					email,
					languageCode,
					message: res.originalMessage,
					organization,
				});
			})
			.catch(console.error);
	}

	async welcomeUser(
		user: IUser,
		languageCode: LanguagesEnum,
		organizationId?: string,
		originUrl?: string
	) {
		let organization: Organization;
		if (organizationId) {
			organization = await this.organizationRepository.findOne(
				organizationId
			);
		}
		const tenantId = (organization) ? organization.tenantId : RequestContext.currentTenantId();
		const sendOptions = {
			template: 'welcome-user',
			message: {
				to: `${user.email}`
			},
			locals: {
				locale: languageCode,
				email: user.email,
				host: originUrl || env.clientBaseUrl,
				organizationId: organizationId || IsNull(),
				tenantId
			}
		};

		await (await this.getEmailInstance(organizationId, tenantId))
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
		user: IUser,
		url: string,
		languageCode: LanguagesEnum,
		organizationId: string,
		originUrl?: string
	) {
		let organization: Organization;
		if (organizationId) {
			organization = await this.organizationRepository.findOne(
				organizationId
			);
		}
		const tenantId = (organization) ? organization.tenantId : RequestContext.currentTenantId();
		const sendOptions = {
			template: 'password',
			message: {
				to: `${user.email}`,
				subject: 'Forgotten Password'
			},
			locals: {
				locale: languageCode,
				generatedUrl: url,
				host: originUrl || env.clientBaseUrl,
				organizationId,
				tenantId
			}
		};
		await (await this.getEmailInstance(organizationId, tenantId))
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
		let organization: Organization;
		if (organizationId) {
			organization = await this.organizationRepository.findOne(
				organizationId
			);
		}
		const tenantId = (organization) ? organization.tenantId : RequestContext.currentTenantId();
		const sendOptions = {
			template: 'email-appointment',
			message: {
				to: email
			},
			locals: {
				locale: languageCode,
				email: email,
				host: originUrl || env.clientBaseUrl,
				organizationId: organizationId || IsNull(),
				tenantId: tenantId || IsNull()
			}
		};
		await (await this.getEmailInstance(organizationId, tenantId))
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

	async setTimesheetAction(email: string, timesheet: ITimesheet) {
		const languageCode = RequestContext.getLanguageCode();
		const organizationId = timesheet.employee.organizationId;
		const organization = await this.organizationRepository.findOne(
			timesheet.employee.organizationId
		);
		const tenantId = (organization) ? organization.tenantId : RequestContext.currentTenantId();
		const sendOptions = {
			template: 'timesheet-action',
			message: {
				to: email
			},
			locals: {
				locale: languageCode,
				email: email,
				host: env.clientBaseUrl,
				timesheet: timesheet,
				timesheet_action: timesheet.status,
				organizationId,
				tenantId
			}
		};

		await (await this.getEmailInstance(organizationId, tenantId))
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

	async timesheetSubmit(email: string, timesheet: ITimesheet) {
		const languageCode = RequestContext.getLanguageCode();
		const organizationId = timesheet.employee.organizationId;
		const organization = await this.organizationRepository.findOne(
			timesheet.employee.organizationId
		);
		const tenantId = (organization) ? organization.tenantId : RequestContext.currentTenantId();
		const sendOptions = {
			template: 'timesheet-submit',
			message: {
				to: email
			},
			locals: {
				locale: languageCode,
				email: email,
				host: env.clientBaseUrl,
				timesheet: timesheet,
				timesheet_action: timesheet.status,
				organizationId,
				tenantId
			}
		};
		await (await this.getEmailInstance(organizationId, tenantId))
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
		user?: IUser;
	}): Promise<IEmail> {
		const emailEntity = new EmailEntity();
		const {
			templateName: template,
			email,
			languageCode,
			message,
			organization,
			user
		} = createEmailOptions;
		const tenantId = (organization) ? organization.tenantId : RequestContext.currentTenantId();
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

	// tested e-mail send functionality
	private async nodemailerSendEmail(user: IUser, url: string) {
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
