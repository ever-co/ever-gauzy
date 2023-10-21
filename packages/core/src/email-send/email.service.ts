import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as nodemailer from 'nodemailer';
import { Repository, IsNull } from 'typeorm';
import {
	IInviteEmployeeModel,
	IInviteUserModel,
	IOrganization,
	IOrganizationContact,
	LanguagesEnum,
	IJoinEmployeeModel,
	ITimesheet,
	IEmailHistory,
	IUser,
	IInvite,
	IInviteTeamMemberModel,
	IOrganizationTeam,
	IOrganizationTeamJoinRequest,
	EmailTemplateEnum,
	IResendEmailInput,
	EmailStatusEnum
} from '@gauzy/contracts';
import { ConfigService, environment as env } from '@gauzy/config';
import { deepMerge, IAppIntegrationConfig } from '@gauzy/common';
import { RequestContext } from '../core/context';
import { EmailSendService } from './../email-send/email-send.service';
import { EmailTemplate, Organization, EmailHistory } from './../core/entities/internal';

const DISALLOW_EMAIL_SERVER_DOMAIN: string[] = ['@example.com'];

@Injectable()
export class EmailService {

	constructor(
		@InjectRepository(EmailHistory)
		private readonly emailHistoryRepository: Repository<EmailHistory>,

		@InjectRepository(EmailTemplate)
		private readonly emailTemplateRepository: Repository<EmailTemplate>,

		@InjectRepository(Organization)
		private readonly organizationRepository: Repository<Organization>,

		private readonly _emailSendService: EmailSendService,
		private readonly configService: ConfigService
	) { }

	/**
	 *
	 * @param languageCode
	 * @param email
	 * @param contactName
	 * @param invoiceNumber
	 * @param amount
	 * @param currency
	 * @param organization
	 * @param originUrl
	 */
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
		const clientBaseUrl = originUrl || env.clientBaseUrl;

		const sendOptions = {
			template: EmailTemplateEnum.PAYMENT_RECEIPT,
			message: {
				to: email
			},
			locals: {
				locale: languageCode,
				host: clientBaseUrl,
				contactName,
				invoiceNumber,
				amount,
				currency,
				organizationId,
				tenantId,
				organizationName
			}
		};

		const body = {
			templateName: sendOptions.template,
			email: sendOptions.message.to,
			languageCode,
			organization,
			message: ''
		};

		const isEmailBlocked = !!DISALLOW_EMAIL_SERVER_DOMAIN.find(server => body.email.includes(server));
		if (!isEmailBlocked) {
			try {
				const instance = await this._emailSendService.getEmailInstance({ organizationId, tenantId });
				const sendResult = await instance.send(sendOptions);

				body.message = sendResult.originalMessage;
			} catch (error) {
				console.log(`Error while sending payment receipt ${invoiceNumber}: %s`, error?.message);
				throw new BadRequestException(`Error while sending payment receipt ${invoiceNumber}: ${error?.message}`);
			} finally {
				await this.createEmailRecord(body);
			}
		}
	}

	/**
	 *
	 * @param languageCode
	 * @param email
	 * @param base64
	 * @param invoiceNumber
	 * @param invoiceId
	 * @param isEstimate
	 * @param token
	 * @param originUrl
	 * @param organization
	 */
	async emailInvoice(
		languageCode: LanguagesEnum,
		email: string,
		base64: string,
		invoiceNumber: number,
		invoiceId: string,
		isEstimate: boolean,
		token: any,
		origin: string,
		organization: IOrganization
	) {
		const tenantId = RequestContext.currentTenantId();
		const { id: organizationId } = organization;
		const baseUrl = origin || env.clientBaseUrl;
		const sendOptions = {
			template: isEstimate ? EmailTemplateEnum.EMAIL_ESTIMATE : EmailTemplateEnum.EMAIL_INVOICE,
			message: {
				to: `${email}`,
				attachments: [
					{
						filename: `${isEstimate ? 'Estimate' : 'Invoice'}-${invoiceNumber}.pdf`,
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
		const body = {
			templateName: sendOptions.template,
			email: sendOptions.message.to,
			languageCode,
			organization,
			message: ''
		}
		const isEmailBlocked = !!DISALLOW_EMAIL_SERVER_DOMAIN.find(server => body.email.includes(server));
		if (!isEmailBlocked) {
			try {
				const instance = await this._emailSendService.getEmailInstance({ organizationId, tenantId });
				const send = await instance.send(sendOptions);

				body['message'] = send.originalMessage;
			} catch (error) {
				console.log(`Error while sending email invoice ${invoiceNumber}: %s`, error?.message);
				throw new BadRequestException(`Error while sending email invoice ${invoiceNumber}: ${error?.message}`);
			} finally {
				await this.createEmailRecord(body);
			}
		}
	}

	/**
	 *
	 * @param organizationContact
	 * @param inviterUser
	 * @param organization
	 * @param invite
	 * @param languageCode
	 * @param originUrl
	 */
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
			template: EmailTemplateEnum.INVITE_ORGANIZATION_CLIENT,
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
		const body = {
			templateName: sendOptions.template,
			email: sendOptions.message.to,
			languageCode,
			message: '',
			organization
		}
		const isEmailBlocked = !!DISALLOW_EMAIL_SERVER_DOMAIN.find(server => body.email.includes(server));
		if (!isEmailBlocked) {
			try {
				const instance = await this._emailSendService.getEmailInstance({ organizationId, tenantId });
				const send = await instance.send(sendOptions);

				body['message'] = send.originalMessage;
			} catch (error) {
				console.log(`Error while sending invite organization contact: %s`, error?.message);
				throw new BadRequestException(`Error while sending invite organization contact: ${error?.message}`);
			} finally {
				await this.createEmailRecord(body);
			}
		}
	}

	/**
	 *
	 * @param inviteUserModel
	 */
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
			template: EmailTemplateEnum.INVITE_USER,
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
		const body = {
			templateName: sendOptions.template,
			email: sendOptions.message.to,
			languageCode,
			message: '',
			organization,
			user: invitedBy
		}
		const match = !!DISALLOW_EMAIL_SERVER_DOMAIN.find((server) => body.email.includes(server));
		if (!match) {
			try {
				const instance = await this._emailSendService.getEmailInstance({ organizationId, tenantId });
				const send = await instance.send(sendOptions);

				body['message'] = send.originalMessage;
			} catch (error) {
				console.log(`Error while sending invite user: %s`, error);
			} finally {
				await this.createEmailRecord(body);
			}
		}
	}

	/**
	 * Invite team members
	 *
	 * @param invite
	 */
	async inviteTeamMember(invite: IInviteTeamMemberModel) {
		const { email, organization, languageCode, invitedBy, teams, inviteCode, inviteLink, originUrl } = invite;
		const { id: organizationId } = organization;
		const tenantId = RequestContext.currentTenantId();

		const sendOptions = {
			template: EmailTemplateEnum.INVITE_GAUZY_TEAMS,
			message: {
				to: `${email}`
			},
			locals: {
				email,
				organizationId,
				tenantId,
				inviteCode,
				teams,
				inviteLink,
				locale: languageCode,
				host: originUrl || env.clientBaseUrl
			}
		};
		const body = {
			templateName: sendOptions.template,
			email: sendOptions.message.to,
			languageCode,
			message: '',
			organization,
			user: invitedBy
		}
		const match = !!DISALLOW_EMAIL_SERVER_DOMAIN.find((server) => body.email.includes(server));
		if (!match) {
			try {
				const instance = await this._emailSendService.getEmailInstance({ organizationId, tenantId });
				const send = await instance.send(sendOptions);

				body['message'] = send.originalMessage;
			} catch (error) {
				console.log(`Error while invite team: %s`, error);
			} finally {
				await this.createEmailRecord(body);
			}
		}
	}

	/**
	 *
	 * @param inviteEmployeeModel
	 */
	async inviteEmployee(inviteEmployeeModel: IInviteEmployeeModel) {
		const { email, registerUrl, organization, originUrl, languageCode, invitedBy } = inviteEmployeeModel;
		const tenantId = RequestContext.currentTenantId();
		const { id: organizationId } = organization;

		const sendOptions = {
			template: EmailTemplateEnum.INVITE_EMPLOYEE,
			message: {
				to: `${email}`
			},
			locals: {
				locale: languageCode,
				organizationName: organization.name,
				organizationId,
				tenantId,
				generatedUrl: registerUrl,
				host: originUrl || env.clientBaseUrl
			}
		};
		const body = {
			templateName: sendOptions.template,
			email: sendOptions.message.to,
			languageCode,
			message: '',
			organization,
			user: invitedBy
		}
		const match = !!DISALLOW_EMAIL_SERVER_DOMAIN.find((server) => body.email.includes(server));
		if (!match) {
			try {
				const instance = await this._emailSendService.getEmailInstance({ organizationId, tenantId });
				const send = await instance.send(sendOptions);

				body['message'] = send.originalMessage;
			} catch (error) {
				console.error(error);
			} finally {
				await this.createEmailRecord(body);
			}
		}
	}

	/***
	 *
	 */
	async sendAcceptInvitationEmail(joinEmployeeModel: IJoinEmployeeModel, originUrl?: string) {
		const {
			email,
			employee,
			organization,
			languageCode,
		} = joinEmployeeModel;

		const { id: organizationId, tenantId } = organization;
		const sendOptions = {
			template: EmailTemplateEnum.EMPLOYEE_JOIN,
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

		const body = {
			templateName: sendOptions.template,
			email: sendOptions.message.to,
			languageCode,
			message: '',
			organization,
		}
		const match = !!DISALLOW_EMAIL_SERVER_DOMAIN.find((server) => body.email.includes(server));
		if (!match) {
			try {
				const instance = await this._emailSendService.getEmailInstance({ organizationId, tenantId });
				const send = await instance.send(sendOptions);

				body['message'] = send.originalMessage;
			} catch (error) {
				console.error(error);
			} finally {
				await this.createEmailRecord(body);
			}
		}
	}

	/**
	 *
	 * @param user
	 * @param languageCode
	 * @param organizationId
	 * @param originUrl
	 * @param integration
	 */
	async welcomeUser(
		user: IUser,
		languageCode: LanguagesEnum,
		organizationId?: string,
		originUrl?: string,
		integration?: IAppIntegrationConfig
	) {
		let organization: Organization;
		if (organizationId) {
			organization = await this.organizationRepository.findOneBy({
				id: organizationId
			});
		}
		const tenantId = (organization) ? organization.tenantId : RequestContext.currentTenantId();

		/**
		* Override the default config by merging in the provided values.
		*
		*/
		deepMerge(integration, env.appIntegrationConfig);

		const sendOptions = {
			template: EmailTemplateEnum.WELCOME_USER,
			message: {
				to: `${user.email}`
			},
			locals: {
				locale: languageCode,
				email: user.email,
				host: originUrl || env.clientBaseUrl,
				organizationId: organizationId || IsNull(),
				tenantId,
				...integration
			}
		};

		try {
			const body = {
				templateName: sendOptions.template,
				email: sendOptions.message.to,
				languageCode,
				organization,
				message: '',
			}
			const match = !!DISALLOW_EMAIL_SERVER_DOMAIN.find((server) => body.email.includes(server));
			if (!match) {
				try {
					const instance = await this._emailSendService.getEmailInstance({ organizationId, tenantId });
					const send = await instance.send(sendOptions);

					body['message'] = send.originalMessage;
				} catch (error) {
					console.log('Error while get email instance during welcome user', error);
				} finally {
					await this.createEmailRecord(body);
				}
			}
		} catch (error) {
			console.log('Error while sending welcome user', error);
		}
	}

	/**
	 * Send confirmation email link
	 *
	 * @param user
	 * @param verificationLink
	 */
	async emailVerification(
		user: IUser,
		verificationLink: string,
		verificationCode: string,
		thirdPartyIntegration: IAppIntegrationConfig
	) {
		const { email, firstName, lastName, preferredLanguage } = user;
		const name = [firstName, lastName].filter(Boolean).join(' ');

		/**
		* Override the default config by merging in the provided values.
		*
		*/
		const integration = Object.assign({}, env.appIntegrationConfig, thirdPartyIntegration);
		/**
		 * Email template email options
		 */
		const sendOptions = {
			template: EmailTemplateEnum.EMAIL_VERIFICATION,
			message: {
				to: `${email}`
			},
			locals: {
				name,
				email,
				verificationLink,
				verificationCode,
				...integration,
				locale: preferredLanguage,
				host: env.clientBaseUrl
			}
		};
		const body = {
			templateName: sendOptions.template,
			email: sendOptions.message.to,
			languageCode: sendOptions.locals.locale,
			message: ''
		}
		const match = !!DISALLOW_EMAIL_SERVER_DOMAIN.find((server) => body.email.includes(server));
		if (!match) {
			try {
				const instance = await this._emailSendService.getInstance();
				const send = await instance.send(sendOptions);

				body['message'] = send.originalMessage;
			} catch (error) {
				console.error(error);
			}
		}
	}

	/**
	 *
	 * @param user
	 * @param url
	 * @param languageCode
	 * @param organizationId
	 * @param originUrl
	 */
	async requestPassword(
		user: IUser,
		url: string,
		languageCode: LanguagesEnum,
		organizationId: string,
		originUrl?: string
	) {
		let organization: Organization;
		if (organizationId) {
			organization = await this.organizationRepository.findOneBy({
				id: organizationId
			});
		}
		const tenantId = (organization) ? organization.tenantId : RequestContext.currentTenantId();
		const sendOptions = {
			template: EmailTemplateEnum.PASSWORD_RESET,
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
		const body = {
			templateName: sendOptions.template,
			email: sendOptions.message.to,
			languageCode,
			organization,
			message: '',
		}
		const match = !!DISALLOW_EMAIL_SERVER_DOMAIN.find((server) => body.email.includes(server));
		if (!match) {
			try {
				const instance = await this._emailSendService.getEmailInstance({ organizationId, tenantId });
				const send = await instance.send(sendOptions);

				body['message'] = send.originalMessage;
			} catch (error) {
				console.error(error);
			} finally {
				await this.createEmailRecord(body);
			}
		}
	}

	/**
	 *
	 * @param email
	 * @param languageCode
	 * @param organizationId
	 * @param originUrl
	 */
	async sendAppointmentMail(
		email: string,
		languageCode: LanguagesEnum,
		organizationId?: string,
		originUrl?: string
	) {
		let organization: Organization;
		if (organizationId) {
			organization = await this.organizationRepository.findOneBy({
				id: organizationId
			});
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
		const body = {
			templateName: sendOptions.template,
			email: sendOptions.message.to,
			languageCode,
			organization,
			message: '',
		}
		const match = !!DISALLOW_EMAIL_SERVER_DOMAIN.find((server) => body.email.includes(server));
		if (!match) {
			try {
				const instance = await this._emailSendService.getEmailInstance({ organizationId, tenantId });
				const send = await instance.send(sendOptions);

				body['message'] = send.originalMessage;
			} catch (error) {
				console.error(error);
			} finally {
				await this.createEmailRecord(body);
			}
		}
	}

	/**
	 *
	 * @param email
	 * @param timesheet
	 */
	async setTimesheetAction(email: string, timesheet: ITimesheet) {
		const languageCode = RequestContext.getLanguageCode();
		const organizationId = timesheet.employee.organizationId;
		const organization = await this.organizationRepository.findOneBy({
			id: timesheet.employee.organizationId
		});
		const tenantId = (organization) ? organization.tenantId : RequestContext.currentTenantId();
		const sendOptions = {
			template: EmailTemplateEnum.TIME_SHEET_ACTION,
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
		const body = {
			templateName: sendOptions.template,
			email: email,
			languageCode,
			message: '',
			organization,
			user: timesheet.employee.user
		}
		const match = !!DISALLOW_EMAIL_SERVER_DOMAIN.find((server) => body.email.includes(server));
		if (!match) {
			try {
				const instance = await this._emailSendService.getEmailInstance({ organizationId, tenantId });
				const send = await instance.send(sendOptions);

				body['message'] = send.originalMessage;
			} catch (error) {
				console.error(error);
			} finally {
				await this.createEmailRecord(body);
			}
		}
	}

	/**
	 *
	 * @param email
	 * @param timesheet
	 */
	async timesheetSubmit(email: string, timesheet: ITimesheet) {
		const languageCode = RequestContext.getLanguageCode();
		const organizationId = timesheet.employee.organizationId;
		const organization = await this.organizationRepository.findOneBy({
			id: timesheet.employee.organizationId
		});
		const tenantId = (organization) ? organization.tenantId : RequestContext.currentTenantId();
		const sendOptions = {
			template: EmailTemplateEnum.TIME_SHEET_SUBMIT,
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

		const body = {
			templateName: sendOptions.template,
			email: email,
			languageCode,
			message: '',
			organization,
			user: timesheet.employee.user
		}
		const match = !!DISALLOW_EMAIL_SERVER_DOMAIN.find((server) => body.email.includes(server));
		if (!match) {
			try {
				const instance = await this._emailSendService.getEmailInstance({ organizationId, tenantId });
				const send = await instance.send(sendOptions);

				body['message'] = send.originalMessage;
			} catch (error) {
				console.error(error);
			} finally {
				await this.createEmailRecord(body);
			}
		}
	}

	/**
	 * Password Less Authentication
	 *
	 * @param user
	 * @param languageCode
	 */
	async passwordLessAuthentication(
		email: IUser['email'],
		code: IUser['code'],
		locale: LanguagesEnum,
		integration?: IAppIntegrationConfig
	) {
		/**
		* Override the default config by merging in the provided values.
		*
		*/
		deepMerge(integration, env.appIntegrationConfig);

		const sendOptions = {
			template: EmailTemplateEnum.PASSWORD_LESS_AUTHENTICATION,
			message: {
				to: `${email}`
			},
			locals: {
				locale,
				email,
				host: env.clientBaseUrl,
				inviteCode: code,
				...integration
			}
		};
		const body = {
			templateName: sendOptions.template,
			email: sendOptions.message.to,
			languageCode: locale,
			message: ''
		}
		const match = !!DISALLOW_EMAIL_SERVER_DOMAIN.find((server) => body.email.includes(server));
		if (!match) {
			try {
				const instance = await this._emailSendService.getInstance();
				const send = await instance.send(sendOptions);

				body['message'] = send.originalMessage;
			} catch (error) {
				console.log('Error while sending password less authentication code: %s', error);
			}
		}
	}

	/**
	 * Email Reset
	 *
	 * @param user
	 * @param languageCode
	 */
	async emailReset(
		user: IUser,
		languageCode: LanguagesEnum,
		verificationCode: string,
		organization: IOrganization
	) {
		const integration = Object.assign({}, env.appIntegrationConfig);

		const sendOptions = {
			template: EmailTemplateEnum.EMAIL_RESET,
			message: {
				to: `${user.email}`
			},
			locals: {
				...integration,
				locale: languageCode,
				email: user.email,
				host: env.clientBaseUrl,
				verificationCode,
				name: user.name,
			}
		};
		const body = {
			templateName: sendOptions.template,
			email: sendOptions.message.to,
			languageCode,
			message: '',
			user: user,
			organization
		}

		const match = !!DISALLOW_EMAIL_SERVER_DOMAIN.find((server) => body.email.includes(server));
		if (!match) {
			try {
				const { id: organizationId, tenantId } = organization;

				const instance = await this._emailSendService.getEmailInstance({ organizationId, tenantId });
				const send = await instance.send(sendOptions);

				body['message'] = send.originalMessage;
			} catch (error) {
				console.log('Error while sending password less authentication code: %s', error);
			} finally {
				await this.createEmailRecord(body);
			}
		}
	}

	/**
	 * Organization team join request email
	 *
	 * @param email
	 * @param code
	 * @param languageCode
	 * @param organization
	 */
	async organizationTeamJoinRequest(
		organizationTeam: IOrganizationTeam,
		organizationTeamJoinRequest: IOrganizationTeamJoinRequest,
		languageCode: LanguagesEnum,
		organization: IOrganization,
		integration?: IAppIntegrationConfig
	) {
		/**
		* Override the default config by merging in the provided values.
		*
		*/
		deepMerge(integration, env.appIntegrationConfig);

		const sendOptions = {
			template: EmailTemplateEnum.ORGANIZATION_TEAM_JOIN_REQUEST,
			message: {
				to: `${organizationTeamJoinRequest.email}`
			},
			locals: {
				locale: languageCode,
				host: env.clientBaseUrl,
				...organizationTeam,
				...organizationTeamJoinRequest,
				...integration
			}
		};
		const body = {
			templateName: sendOptions.template,
			email: sendOptions.message.to,
			languageCode,
			message: '',
			organization
		}
		const match = !!DISALLOW_EMAIL_SERVER_DOMAIN.find((server) => body.email.includes(server));
		if (!match) {
			try {
				const instance = await this._emailSendService.getInstance();
				const send = await instance.send(sendOptions);

				body['message'] = send.originalMessage;
			} catch (error) {
				console.error(error);
			} finally {
				await this.createEmailRecord(body);
			}
		}
	}

	async resendEmail(input: IResendEmailInput, languageCode: LanguagesEnum) {

		const { id } = input;
		const emailHistory: IEmailHistory = await this.emailHistoryRepository.findOne({
			where: {
				id
			},
			relations: {
				emailTemplate: true,
				organization: true,
			}
		});
		if (!emailHistory) {
			throw Error('Email History does not exist');
		}
		// Organization
		const organization: IOrganization = emailHistory.organization;
		const email: IEmailHistory['email'] = emailHistory.email;

		const sendOptions = {
			template: emailHistory.emailTemplate.name,
			message: {
				to: `${email}`,
				subject: emailHistory.name,
				html: emailHistory.content
			}
		};

		const isEmailBlocked = !!DISALLOW_EMAIL_SERVER_DOMAIN.find(server => sendOptions.message.to.includes(server));

		if (!isEmailBlocked) {
			try {
				const instance = await this._emailSendService.getEmailInstance({ organizationId: organization.id, tenantId: emailHistory.tenantId });
				await instance.send(sendOptions);
				emailHistory.status = EmailStatusEnum.SENT;

				return await this.emailHistoryRepository.save(emailHistory);
			} catch (error) {
				console.log(`Error while re-sending mail: %s`, error?.message);

				emailHistory.status = EmailStatusEnum.FAILED;
				await this.emailHistoryRepository.save(emailHistory);
				throw new BadRequestException(`Error while re-sending mail: ${error?.message}`);
			}
		}
	}

	private async createEmailRecord(createEmailOptions: {
		templateName: string;
		email: string;
		languageCode: LanguagesEnum;
		message: any;
		organization?: IOrganization;
		user?: IUser;
	}): Promise<IEmailHistory> {
		const emailEntity = new EmailHistory();
		const {
			templateName: template,
			email,
			languageCode,
			message,
			organization,
			user
		} = createEmailOptions;
		const tenantId = (organization) ? organization.tenantId : RequestContext.currentTenantId();
		const emailTemplate = await this.emailTemplateRepository.findOneBy({
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
		return await this.emailHistoryRepository.save(emailEntity);
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
