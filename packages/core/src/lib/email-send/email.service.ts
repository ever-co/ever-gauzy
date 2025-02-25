import { BadRequestException, Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { IsNull } from 'typeorm';
import { IAppIntegrationConfig } from '@gauzy/common';
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
	EmailStatusEnum,
	ITenant
} from '@gauzy/contracts';
import { environment as env } from '@gauzy/config';
import { deepMerge } from '@gauzy/utils';
import { RequestContext } from '../core/context';
import { EmailSendService } from './../email-send/email-send.service';
import { Organization, EmailHistory } from './../core/entities/internal';
import { TypeOrmEmailHistoryRepository } from './../email-history/repository/type-orm-email-history.repository';
import { TypeOrmEmailTemplateRepository } from './../email-template/repository/type-orm-email-template.repository';
import { TypeOrmOrganizationRepository } from './../organization/repository/type-orm-organization.repository';

const DISALLOW_EMAIL_SERVER_DOMAIN: string[] = ['@example.com'];

@Injectable()
export class EmailService {
	constructor(
		readonly typeOrmEmailHistoryRepository: TypeOrmEmailHistoryRepository,
		readonly typeOrmEmailTemplateRepository: TypeOrmEmailTemplateRepository,
		readonly typeOrmOrganizationRepository: TypeOrmOrganizationRepository,
		readonly emailSendService: EmailSendService
	) {}

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

		const isEmailBlocked = !!DISALLOW_EMAIL_SERVER_DOMAIN.find((server) => body.email.includes(server));
		if (!isEmailBlocked) {
			try {
				const instance = await this.emailSendService.getEmailInstance({ organizationId, tenantId });
				const sendResult = await instance.send(sendOptions);

				body.message = sendResult.originalMessage;
			} catch (error) {
				console.log(`Error while sending payment receipt ${invoiceNumber}: %s`, error?.message);
				throw new BadRequestException(
					`Error while sending payment receipt ${invoiceNumber}: ${error?.message}`
				);
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
		};
		const isEmailBlocked = !!DISALLOW_EMAIL_SERVER_DOMAIN.find((server) => body.email.includes(server));
		if (!isEmailBlocked) {
			try {
				const instance = await this.emailSendService.getEmailInstance({ organizationId, tenantId });
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
	 * Sends an invitation email to an organization contact.
	 *
	 * @param organizationContact - The contact to invite.
	 * @param inviterUser - The user sending the invitation.
	 * @param organization - The organization details.
	 * @param invite - The invitation details containing the token.
	 * @param languageCode - The locale for the email.
	 * @param originUrl - Optional override for the base URL.
	 * @returns {Promise<void>}
	 */
	async inviteOrganizationContact(
		organizationContact: IOrganizationContact,
		inviterUser: IUser,
		organization: IOrganization,
		invite: IInvite,
		languageCode: LanguagesEnum,
		originUrl?: string
	): Promise<void> {
		const baseUrl = originUrl || env.clientBaseUrl;
		const { id: organizationId, tenantId = RequestContext.currentTenantId() } = organization;
		const { primaryEmail } = organizationContact;

		// Define the email sending options.
		const sendOptions = {
			template: EmailTemplateEnum.INVITE_ORGANIZATION_CLIENT,
			message: {
				to: primaryEmail
			},
			locals: {
				locale: languageCode,
				name: organizationContact.name,
				host: baseUrl,
				id: organizationContact.id,
				inviterName: inviterUser ? inviterUser.name || '' : '',
				organizationName: organization.name,
				organizationId,
				tenantId,
				generatedUrl: `${baseUrl}#/auth/accept-client-invite?email=${primaryEmail}&token=${invite.token}`
			}
		};

		// Prepare the body for the email record.
		const body = {
			templateName: sendOptions.template,
			email: sendOptions.message.to,
			languageCode,
			message: '',
			organization
		};

		// Check if the email domain is allowed.
		const match = !!DISALLOW_EMAIL_SERVER_DOMAIN.find((server) => body.email.includes(server));

		if (!match) {
			try {
				// Get an email instance and send the email.
				const instance = await this.emailSendService.getEmailInstance({ organizationId, tenantId });
				const send = await instance.send(sendOptions);
				body.message = send.originalMessage;
			} catch (error) {
				console.log(`Error while sending invite organization contact: %s`, error?.message);
				throw new BadRequestException(`Error while sending invite organization contact: ${error?.message}`);
			} finally {
				await this.createEmailRecord(body);
			}
		}
	}

	/**
	 * Invites a user by sending an email using the provided invite model.
	 *
	 * @param inviteUserModel - The invite model containing user and organization details.
	 * @returns A promise that resolves when the invitation email has been sent and the record created.
	 */
	async inviteUser(inviteUserModel: IInviteUserModel) {
		const { email, role, organization, registerUrl, originUrl, languageCode, invitedByUser } = inviteUserModel;
		const { id: organizationId, tenantId = RequestContext.currentTenantId() } = organization;

		// Define the email sending options.
		const sendOptions = {
			template: EmailTemplateEnum.INVITE_USER,
			message: {
				to: email
			},
			locals: {
				locale: languageCode,
				role,
				organizationName: organization.name,
				organizationId,
				tenantId,
				generatedUrl: registerUrl,
				host: originUrl || env.clientBaseUrl
			}
		};

		// Prepare the body for the email record.
		const body = {
			templateName: sendOptions.template,
			email: sendOptions.message.to,
			languageCode,
			message: '',
			organization,
			user: invitedByUser
		};

		// Check if the email domain is allowed.
		const match = !!DISALLOW_EMAIL_SERVER_DOMAIN.find((server) => body.email.includes(server));

		if (!match) {
			try {
				// Get an email instance and send the email.
				const instance = await this.emailSendService.getEmailInstance({ organizationId, tenantId });
				const send = await instance.send(sendOptions);
				body.message = send.originalMessage;
			} catch (error) {
				console.log(`Error while sending invite user: %s`, error);
				throw new BadRequestException(`Error while sending invite user: ${error?.message}`);
			} finally {
				await this.createEmailRecord(body);
			}
		}
	}

	/**
	 * Invite team members by sending an email with the invite details.
	 *
	 * @param invite - The invite model containing team member invite details.
	 * @returns A promise that resolves when the invitation email is sent and recorded.
	 */
	public async inviteTeamMember(invite: IInviteTeamMemberModel): Promise<void> {
		const { email, organization, languageCode, invitedByUser, teams, inviteCode, inviteLink, originUrl } = invite;
		const { id: organizationId, tenantId = RequestContext.currentTenantId() } = organization;

		// Define the email send options.
		const sendOptions = {
			template: EmailTemplateEnum.INVITE_GAUZY_TEAMS,
			message: {
				to: email
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

		// Prepare the email record body.
		const body = {
			templateName: sendOptions.template,
			email: sendOptions.message.to,
			languageCode,
			message: '',
			organization,
			user: invitedByUser
		};

		// Check if the email domain is disallowed.
		const match = !!DISALLOW_EMAIL_SERVER_DOMAIN.find((server) => body.email.includes(server));

		if (!match) {
			try {
				// Get an email instance and send the email.
				const instance = await this.emailSendService.getEmailInstance({ organizationId, tenantId });
				const send = await instance.send(sendOptions);
				body.message = send.originalMessage;
			} catch (error) {
				console.log(`Error while sending invite team: %s`, error);
				throw new BadRequestException(`Error while sending invite team: ${error?.message}`);
			} finally {
				await this.createEmailRecord(body);
			}
		}
	}

	/**
	 * Invites an employee by sending an email using the provided invite model.
	 *
	 * @param inviteEmployeeModel - The model containing the details for the employee invite.
	 * @returns A promise that resolves when the invitation email has been sent and recorded.
	 */
	public async inviteEmployee(inviteEmployeeModel: IInviteEmployeeModel): Promise<void> {
		const { email, registerUrl, organization, originUrl, languageCode, invitedByUser } = inviteEmployeeModel;
		const { id: organizationId, tenantId = RequestContext.currentTenantId() } = organization;

		// Build email send options.
		const sendOptions = {
			template: EmailTemplateEnum.INVITE_EMPLOYEE,
			message: {
				to: email
			},
			locals: {
				locale: languageCode,
				organizationName: organization.name,
				organizationId,
				tenantId,
				generatedUrl: registerUrl,
				host: originUrl ?? env.clientBaseUrl
			}
		};

		// Prepare the email record body.
		const body = {
			templateName: sendOptions.template,
			email: sendOptions.message.to,
			languageCode,
			message: '',
			organization,
			user: invitedByUser
		};

		// Check if the email domain is disallowed.
		const match = !!DISALLOW_EMAIL_SERVER_DOMAIN.find((server) => body.email.includes(server));

		if (!match) {
			try {
				// Get an email instance and send the email.
				const instance = await this.emailSendService.getEmailInstance({ organizationId, tenantId });
				const send = await instance.send(sendOptions);
				body.message = send.originalMessage;
			} catch (error) {
				console.error('Error while sending invite employee email:', error);
				throw new BadRequestException(`Error while sending invite employee email: ${error?.message}`);
			} finally {
				// Create the email record regardless of success or failure.
				await this.createEmailRecord(body);
			}
		}
	}

	/**
	 * Sends an email to accept an invitation for an employee.
	 *
	 * @param joinEmployeeModel - The model containing details for the employee's join invitation.
	 * @param originUrl - Optional origin URL to override the default client base URL.
	 * @returns A promise that resolves when the email has been sent and recorded.
	 */
	public async sendAcceptInvitationEmail(joinEmployeeModel: IJoinEmployeeModel, originUrl?: string): Promise<void> {
		const { email, employee, organization, languageCode } = joinEmployeeModel;
		const { id: organizationId, tenantId = RequestContext.currentTenantId() } = organization;

		// Define the email sending options.
		const sendOptions = {
			template: EmailTemplateEnum.EMPLOYEE_JOIN,
			message: {
				to: email
			},
			locals: {
				host: originUrl ?? env.clientBaseUrl,
				locale: languageCode,
				organizationName: organization.name,
				employeeName: employee.user.firstName
			}
		};

		// Prepare the email record body.
		const body = {
			templateName: sendOptions.template,
			email: sendOptions.message.to,
			languageCode,
			message: '',
			organization
		};

		// Check if the email domain is disallowed.
		const match = !!DISALLOW_EMAIL_SERVER_DOMAIN.find((server) => body.email.includes(server));

		if (!match) {
			try {
				// Get the email instance and send the email.
				const instance = await this.emailSendService.getEmailInstance({ organizationId, tenantId });
				const send = await instance.send(sendOptions);
				body.message = send.originalMessage;
			} catch (error) {
				console.error('Error while sending acceptance invitation email:', error);
			} finally {
				// Log or persist the email record.
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
			organization = await this.typeOrmOrganizationRepository.findOneBy({
				id: organizationId
			});
		}
		const tenantId = organization ? organization.tenantId : RequestContext.currentTenantId();

		// Override the default config by merging in the provided values.
		const appIntegration = deepMerge(env.appIntegrationConfig, integration);

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
				...appIntegration
			}
		};

		try {
			const body = {
				templateName: sendOptions.template,
				email: sendOptions.message.to,
				languageCode,
				organization,
				message: ''
			};
			const match = !!DISALLOW_EMAIL_SERVER_DOMAIN.find((server) => body.email.includes(server));
			if (!match) {
				try {
					const instance = await this.emailSendService.getEmailInstance({ organizationId, tenantId });
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
		integration: IAppIntegrationConfig
	) {
		const { email, firstName, lastName, preferredLanguage } = user;
		const name = [firstName, lastName].filter(Boolean).join(' ') || email;

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
		};
		const match = !!DISALLOW_EMAIL_SERVER_DOMAIN.find((server) => body.email.includes(server));
		if (!match) {
			try {
				const instance = await this.emailSendService.getInstance();
				const send = await instance.send(sendOptions);

				body['message'] = send.originalMessage;
			} catch (error) {
				console.error(error);
			}
		}
	}

	/**
	 * Sends a password reset request to the user via email.
	 *
	 * This method sends a password reset email to the specified user using the provided reset link.
	 * It integrates with an email service to send the email and logs the email message to a record.
	 * The function checks whether the user's email domain is allowed before proceeding with the email.
	 *
	 * @param user - The user object containing the user's information, including their email.
	 * @param resetLink - The generated password reset link that will be sent to the user's email.
	 * @param languageCode - The language code to use for the email localization.
	 * @param originUrl - Optional URL that defines the origin of the reset link. If not provided,
	 *                    it defaults to the application's client base URL.
	 * @returns {Promise<void>} - A promise that resolves once the email has been sent and the record has been created.
	 */
	async requestPassword(
		user: IUser,
		resetLink: string,
		languageCode: LanguagesEnum,
		originUrl?: string
	): Promise<void> {
		const { email, name, tenant } = user;
		const integration = { ...env.appIntegrationConfig }; // Clone app integration config

		// Prepare email sending options
		const sendOptions = {
			template: EmailTemplateEnum.PASSWORD_RESET,
			message: { to: email },
			locals: {
				...integration,
				userName: name,
				tenantName: tenant?.name, // Tenant is optional
				locale: languageCode,
				generatedUrl: resetLink,
				host: originUrl || env.clientBaseUrl
			}
		};

		const body = {
			templateName: sendOptions.template,
			email,
			languageCode,
			message: ''
		};

		// Check if the email domain is disallowed
		if (DISALLOW_EMAIL_SERVER_DOMAIN.some((server) => email.includes(server))) {
			return;
		}

		try {
			// Retrieve the email service instance and send the email
			const instance = await this.emailSendService.getInstance();
			const send = await instance.send(sendOptions);

			// Record the original message
			body.message = send.originalMessage;
		} catch (error) {
			console.error('Failed to send password reset email:', error);
		} finally {
			// Create an email record
			await this.createEmailRecord(body);
		}
	}

	/**
	 * Sends a multi-tenant password reset email to a user across multiple tenants.
	 *
	 * @param email The email of the user.
	 * @param tenants Array of tenants and user details with reset links.
	 * @param languageCode The language code for localization.
	 * @param originUrl The origin URL to be used for generating reset links.
	 */
	async multiTenantResetPassword(
		email: string,
		tenants: { resetLink: string; tenant?: ITenant; user: IUser }[],
		languageCode: LanguagesEnum,
		originUrl: string
	) {
		const integration = { ...env.appIntegrationConfig }; // Clone app integration config

		// Iterate over each tenant and user, constructing email items
		const items = tenants.map(({ resetLink, tenant, user }) => ({
			tenantName: tenant?.name ?? 'Not Created', // If tenant is missing, use 'Not Created' or 'Not Yet'
			userName: user.name, //
			resetLink,
			tenantId: tenant?.id ?? RequestContext.currentTenantId() // Fallback to current tenant ID if tenant is not available
		}));

		// Prepare email sending options
		const sendOptions = {
			template: EmailTemplateEnum.MULTI_TENANT_PASSWORD_RESET,
			message: { to: email },
			locals: {
				...integration,
				locale: languageCode,
				host: originUrl || env.clientBaseUrl,
				items
			}
		};

		// Prepare email record body
		const body = {
			templateName: sendOptions.template,
			email: sendOptions.message.to,
			languageCode,
			message: ''
		};

		// Return early if the email domain is disallowed
		if (DISALLOW_EMAIL_SERVER_DOMAIN.some((server) => email.includes(server))) {
			return;
		}

		try {
			// Retrieve the email service instance and send the email
			const instance = await this.emailSendService.getInstance();
			const send = await instance.send(sendOptions);

			// Record the original message
			body.message = send.originalMessage;
		} catch (error) {
			console.error('Failed to send multi-tenant password reset email:', error);
		} finally {
			await this.createEmailRecord(body);
		}
	}

	/**
	 *
	 * @param email
	 * @param languageCode
	 * @param organizationId
	 * @param originUrl
	 */
	async sendAppointmentMail(email: string, languageCode: LanguagesEnum, organizationId?: string, originUrl?: string) {
		let organization: Organization;
		if (organizationId) {
			organization = await this.typeOrmOrganizationRepository.findOneBy({
				id: organizationId
			});
		}
		const tenantId = organization ? organization.tenantId : RequestContext.currentTenantId();
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
			message: ''
		};
		const match = !!DISALLOW_EMAIL_SERVER_DOMAIN.find((server) => body.email.includes(server));
		if (!match) {
			try {
				const instance = await this.emailSendService.getEmailInstance({ organizationId, tenantId });
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
		const organization = await this.typeOrmOrganizationRepository.findOneBy({
			id: timesheet.employee.organizationId
		});
		const tenantId = organization ? organization.tenantId : RequestContext.currentTenantId();
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
		};
		const match = !!DISALLOW_EMAIL_SERVER_DOMAIN.find((server) => body.email.includes(server));
		if (!match) {
			try {
				const instance = await this.emailSendService.getEmailInstance({ organizationId, tenantId });
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
		const organization = await this.typeOrmOrganizationRepository.findOneBy({
			id: timesheet.employee.organizationId
		});
		const tenantId = organization ? organization.tenantId : RequestContext.currentTenantId();
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
		};
		const match = !!DISALLOW_EMAIL_SERVER_DOMAIN.find((server) => body.email.includes(server));
		if (!match) {
			try {
				const instance = await this.emailSendService.getEmailInstance({ organizationId, tenantId });
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
	 * Sends a magic login code to the user's email for password-less authentication.
	 *
	 * @param email - User's email address.
	 * @param magicCode - Generated magic code for login.
	 * @param magicLink - Link for password-less authentication.
	 * @param locale - Language/locale for email content.
	 * @param integration - App integration configuration.
	 * @param expireMinutes - Number of minutes until the magic code expires.
	 * @returns {Promise<void>} - A promise indicating the completion of the operation.
	 */
	async sendMagicLoginCode({
		email,
		magicCode,
		magicLink,
		locale,
		integration
	}: {
		email: IUser['email'];
		magicCode: IUser['code'];
		magicLink: IAppIntegrationConfig['appMagicSignUrl'];
		locale: LanguagesEnum;
		integration: IAppIntegrationConfig;
	}): Promise<void> {
		/** */
		const sendOptions = {
			template: EmailTemplateEnum.PASSWORD_LESS_AUTHENTICATION,
			message: {
				to: `${email}`
			},
			locals: {
				locale,
				email,
				magicCode,
				magicLink,
				...integration
			}
		};

		/** */
		const body = {
			templateName: sendOptions.template,
			email: sendOptions.message.to,
			languageCode: locale,
			message: ''
		};

		const match = !!DISALLOW_EMAIL_SERVER_DOMAIN.find((server) => body.email.includes(server));

		// Check if the email domain is disallowed
		if (!match) {
			try {
				// Get the email sending service instance
				const instance = await this.emailSendService.getInstance();

				if (instance) {
					// Send the email
					const send = await instance.send(sendOptions);
					// Update the body with the original message
					body['message'] = send.originalMessage;
				} else {
					console.error('Error while getting email instance for password-less authentication');
				}
			} catch (error) {
				// Handle errors during email sending
				console.log('Error while sending password-less authentication code: %s', error);
			}
		}
	}

	/**
	 * Email Reset
	 *
	 * @param user
	 * @param languageCode
	 */
	async emailReset(user: IUser, languageCode: LanguagesEnum, verificationCode: string, organization: IOrganization) {
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
				name: user.name
			}
		};
		const body = {
			templateName: sendOptions.template,
			email: sendOptions.message.to,
			languageCode,
			message: '',
			user: user,
			organization
		};

		const match = !!DISALLOW_EMAIL_SERVER_DOMAIN.find((server) => body.email.includes(server));
		if (!match) {
			try {
				const { id: organizationId, tenantId } = organization;

				const instance = await this.emailSendService.getEmailInstance({ organizationId, tenantId });
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
		};
		const match = !!DISALLOW_EMAIL_SERVER_DOMAIN.find((server) => body.email.includes(server));
		if (!match) {
			try {
				const instance = await this.emailSendService.getInstance();
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
	 * @param languageCode
	 * @param email
	 * @param candidateName
	 * @param organization
	 * @param originUrl
	 */
	async sendRejectionEmail(
		languageCode: LanguagesEnum,
		email: string,
		candidateName: string,
		organization: IOrganization,
		originUrl: string
	) {
		const tenantId = RequestContext.currentTenantId();
		const { id: organizationId, name: organizationName } = organization;
		const clientBaseUrl = originUrl || env.clientBaseUrl;

		const sendOptions = {
			template: EmailTemplateEnum.REJECT_CANDIDATE,
			message: {
				to: email
			},
			locals: {
				locale: languageCode,
				host: clientBaseUrl,
				candidateName,
				organizationName,
				tenantId,
				organizationId
			}
		};

		const body = {
			templateName: sendOptions.template,
			email: sendOptions.message.to,
			languageCode,
			organization,
			message: ''
		};

		const isEmailBlocked = !!DISALLOW_EMAIL_SERVER_DOMAIN.find((server) => body.email.includes(server));
		if (!isEmailBlocked) {
			try {
				const instance = await this.emailSendService.getEmailInstance({ organizationId, tenantId });
				const sendResult = await instance.send(sendOptions);

				body.message = sendResult.originalMessage;
			} catch (error) {
				console.log(`Error while sending rejection email to ${candidateName}: %s`, error?.message);
				throw new BadRequestException(
					`Error while sending rejection email to ${candidateName}: ${error?.message}`
				);
			} finally {
				await this.createEmailRecord(body);
			}
		}
	}

	async resendEmail(input: IResendEmailInput, languageCode: LanguagesEnum) {
		const { id } = input;
		const emailHistory: IEmailHistory = await this.typeOrmEmailHistoryRepository.findOne({
			where: {
				id
			},
			relations: {
				emailTemplate: true,
				organization: true
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

		const isEmailBlocked = !!DISALLOW_EMAIL_SERVER_DOMAIN.find((server) => sendOptions.message.to.includes(server));

		if (!isEmailBlocked) {
			try {
				const instance = await this.emailSendService.getEmailInstance({
					organizationId: organization.id,
					tenantId: emailHistory.tenantId
				});
				await instance.send(sendOptions);
				emailHistory.status = EmailStatusEnum.SENT;

				return await this.typeOrmEmailHistoryRepository.save(emailHistory);
			} catch (error) {
				console.log(`Error while re-sending mail: %s`, error?.message);

				emailHistory.status = EmailStatusEnum.FAILED;
				await this.typeOrmEmailHistoryRepository.save(emailHistory);
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
		const { templateName: template, email, languageCode, message, organization, user } = createEmailOptions;
		const tenantId = organization ? organization.tenantId : RequestContext.currentTenantId();
		const emailTemplate = await this.typeOrmEmailTemplateRepository.findOneBy({
			name: template + '/html',
			languageCode
		});
		emailEntity.name = message.subject;
		emailEntity.email = email;
		emailEntity.content = message.html;
		emailEntity.emailTemplate = emailTemplate;
		emailEntity.tenantId = tenantId;
		emailEntity.organizationId = organization ? organization.id : null;
		if (user) {
			emailEntity.user = user;
		}
		return await this.typeOrmEmailHistoryRepository.save(emailEntity);
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
