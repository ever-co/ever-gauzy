import { environment } from '@env-api/environment';
import {
	OrganizationClients,
	OrganizationDepartment,
	OrganizationProjects,
	LanguagesEnum,
} from '@gauzy/models';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as Email from 'email-templates';
import * as Handlebars from 'handlebars';
import * as nodemailer from 'nodemailer';
import { Repository } from 'typeorm';
import { CrudService } from '../core';
import { EmailTemplate } from '../email-template/email-template.entity';
import { Organization } from '../organization/organization.entity';
import { User } from '../user/user.entity';
import { Email as IEmail } from './email.entity';
import { Invite } from '../invite/invite.entity';

export interface InviteUserModel {
	email: string;
	role: string;
	organization: Organization;
	registerUrl: string;
	languageCode: LanguagesEnum;
	invitedBy: User;
	originUrl?: string;
}

export interface InviteEmployeeModel {
	email: string;
	registerUrl: string;
	organization: Organization;
	languageCode: LanguagesEnum;
	invitedBy: User;
	projects?: OrganizationProjects[];
	clients?: OrganizationClients[];
	departments?: OrganizationDepartment[];
	originUrl?: string;
}

@Injectable()
export class EmailService extends CrudService<IEmail> {
	constructor(
		@InjectRepository(IEmail)
		private readonly emailRepository: Repository<IEmail>,
		@InjectRepository(EmailTemplate)
		private readonly emailTemplateRepository: Repository<EmailTemplate>,
		@InjectRepository(Organization)
		private readonly organizationRepository: Repository<Organization>
	) {
		super(emailRepository);
	}

	email = new Email({
		message: {
			from: 'Gauzy@Ever.co',
		},
		transport: {
			jsonTransport: true,
		},
		i18n: {},
		views: {
			options: {
				extension: 'hbs',
			},
		},
		preview: {
			open: {
				app: 'firefox',
				wait: false,
			},
		},
		render: (view, locals) => {
			return new Promise(async (resolve, reject) => {
				view = view.replace('\\', '/');
				const emailTemplate = await this.emailTemplateRepository.find({
					name: view,
					languageCode: locals.locale || 'en',
				});
				if (!emailTemplate || emailTemplate.length < 1) {
					return resolve('');
				}

				const template = Handlebars.compile(emailTemplate[0].hbs);
				const html = template(locals);

				return resolve(html);
			});
		},
	});

	emailInvoice(
		languageCode: LanguagesEnum,
		email: string,
		originUrl?: string
	) {
		this.email
			.send({
				template: 'email-invoice',
				message: {
					to: `${email}`,
					// attachments: [{
					// 	filename: 'Invoice.pdf'
					// }]
				},
				locals: {
					locale: languageCode,
					host: originUrl || environment.host,
				},
			})
			.then((res) => {
				this.createEmailRecord({
          templateName: 'email-invoice',
          email,
          languageCode,
          message: res.originalMessage          
        });
			})
			.catch(console.error);
	}

	inviteOrganizationClient(
		organizationClient: OrganizationClients,
		inviterUser: User,
		organization: Organization,
		invite: Invite,
		languageCode: LanguagesEnum,
		originUrl?: string
	) {
		const sendOptions = {
			template: 'invite-organization-client',
			message: {
				to: `${organizationClient.primaryEmail}`
			},
			locals: {
				locale: languageCode,
				name: organizationClient.name,
				host: originUrl || environment.host,
				id: organizationClient.id,
				inviterName: inviterUser
					? (inviterUser.firstName || '') +
					  (inviterUser.lastName || '')
					: '',
				organizationName: organization && organization.name,
				generatedUrl:
					originUrl +
					`#/auth/accept-client-invite?email=${organizationClient.primaryEmail}&token=${invite.token}`
			}
		};

		this.email
			.send(sendOptions)
			.then((res) => {
				this.createEmailRecord({
					templateName: sendOptions.template,
					email: organizationClient.primaryEmail,
					languageCode,
					message: res.originalMessage,
					organization
				});
			})
			.catch(console.error);
	}

	inviteUser(inviteUserModel: InviteUserModel) {
		const {
			email,
			role,
			organization,
			registerUrl,
			originUrl,
			languageCode,
			invitedBy
		} = inviteUserModel;

		const sendOptions = {
			template: 'invite-user',
			message: {
				to: `${email}`
			},
			locals: {
				locale: languageCode,
				role: role,
				organization: organization.name,
				generatedUrl: registerUrl,
				host: originUrl || environment.host
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

	inviteEmployee(inviteEmployeeModel: InviteEmployeeModel) {
		const {
			email,
			registerUrl,
			projects,
			organization,
			originUrl,
			languageCode,
			invitedBy
		} = inviteEmployeeModel;

		const sendOptions = {
			template: 'invite-employee',
			message: {
				to: `${email}`
			},
			locals: {
				locale: languageCode,
				role: projects,
				organization: organization.name,
				generatedUrl: registerUrl,
				host: originUrl || environment.host
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
		originUrl?: string,
		organizationId?: string
	) {
		const sendOptions = {
			template: 'welcome-user',
			message: {
				to: `${user.email}`
			},
			locals: {
				locale: languageCode,
				email: user.email,
				host: originUrl || environment.host
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
					message: res.originalMessage,
					organization
				});
			})
			.catch(console.error);
	}

	async requestPassword(
		user: User,
		url: string,
		languageCode: LanguagesEnum,
		originUrl?: string
	) {
		const sendOptions = {
			template: 'password',
			message: {
				to: `${user.email}`,
				subject: 'Forgotten Password'
			},
			locals: {
				locale: languageCode,
				generatedUrl: url,
				host: originUrl || environment.host
			}
		};

		const organization = await this.organizationRepository.findOne(
			user.employee.orgId
		);

		this.email
			.send(sendOptions)
			.then((res) => {
				this.createEmailRecord({
					templateName: sendOptions.template,
					email: user.email,
					languageCode,
					message: res.originalMessage,
					organization
				});
			})
			.catch(console.error);
	}

	async createEmailRecord(createEmailOptions: {
		templateName: string;
		email: string;
		languageCode: LanguagesEnum;
		message: any;
		organization?: Organization;
		user?: User;
	}): Promise<IEmail> {
		const emailEntity = new IEmail();

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

		if (organization) {
			emailEntity.organizationId = organization.id;
		}

		if (user) {
			emailEntity.user = user;
		}

		return this.emailRepository.save(emailEntity);
	}

	// tested e-mail send functionality
	async nodemailerSendEmail(user: User, url: string) {
		const testAccount = await nodemailer.createTestAccount();

		const transporter = nodemailer.createTransport({
			host: 'smtp.ethereal.email',
			port: 587,
			secure: false, // true for 465, false for other ports
			auth: {
				user: testAccount.user,
				pass: testAccount.pass,
			},
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
				'>Click here</a>',
		});

		console.log('Message sent: %s', info.messageId);
		console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
	}
}
