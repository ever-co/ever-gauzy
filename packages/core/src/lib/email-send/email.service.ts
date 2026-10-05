import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { IsNull, MoreThanOrEqual } from 'typeorm';
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
	ITenant,
	ID
} from '@gauzy/contracts';
import { environment as env } from '@gauzy/config';
import { deepMerge } from '@gauzy/utils';
import { allowedEmailBaseUrl, warnRejectedEmailLink, withAllowedEmailLinks } from '../auth/email-link-origin';
import { RequestContext } from '../core/context';
import { EmailSendService } from './../email-send/email-send.service';
import { describeEmailSendError } from './email-send-error';
import { Organization, EmailHistory } from './../core/entities/internal';
import { TypeOrmEmailHistoryRepository } from './../email-history/repository/type-orm-email-history.repository';
import { TypeOrmEmailTemplateRepository } from './../email-template/repository/type-orm-email-template.repository';
import { TypeOrmOrganizationRepository } from './../organization/repository/type-orm-organization.repository';

const DISALLOW_EMAIL_SERVER_DOMAIN: string[] = ['@example.com'];

/**
 * Headers for emails that carry a sign-in or verification secret in a link.
 *
 * Postmark rewrites every link for click tracking when the server has TrackLinks on (ours: HtmlAndText),
 * and stores the original URL - token, address and all - as the click's OriginalLink. `X-PM-TrackLinks:
 * None` turns that off for one message. Other providers ignore the header.
 */
const NO_LINK_TRACKING_HEADERS = { 'X-PM-TrackLinks': 'None' };

@Injectable()
export class EmailService {
	private readonly logger = new Logger(EmailService.name);

	constructor(
		readonly typeOrmEmailHistoryRepository: TypeOrmEmailHistoryRepository,
		readonly typeOrmEmailTemplateRepository: TypeOrmEmailTemplateRepository,
		readonly typeOrmOrganizationRepository: TypeOrmOrganizationRepository,
		readonly emailSendService: EmailSendService
	) {}

	/**
	 * The base URL an email's links are built on: the caller's origin (the request's `Origin` header
	 * or an `originalUrl`) when this deployment serves it, otherwise `CLIENT_BASE_URL`.
	 * See `auth/email-link-origin.ts`.
	 *
	 * @param originUrl The origin the caller supplied, if any.
	 */
	private emailBaseUrl(originUrl?: string): string {
		return allowedEmailBaseUrl(originUrl, env.clientBaseUrl);
	}

	/**
	 * `integration` with every link (`appLink`, `companyLink`, ...) on an origin this deployment does
	 * not serve replaced by the configured one. See `auth/email-link-origin.ts`.
	 *
	 * @param integration The integration values for a template.
	 * @param template Only for the log line.
	 */
	private withAllowedLinks<T>(integration: T, template: string): T {
		return withAllowedEmailLinks(integration, warnRejectedEmailLink(this.logger, `the "${template}" email`));
	}

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
		const clientBaseUrl = this.emailBaseUrl(originUrl);

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
				this.logger.error(
					`Payment receipt ${invoiceNumber} could not be sent: ${describeEmailSendError(error)}`
				);
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
		const baseUrl = this.emailBaseUrl(origin);
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
				this.logger.error(
					`Invoice / estimate email ${invoiceNumber} could not be sent: ${describeEmailSendError(error)}`
				);
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
		const baseUrl = this.emailBaseUrl(originUrl);
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
				this.logger.error(
					`Organization contact invitation could not be sent: ${describeEmailSendError(error)}`
				);
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
				host: this.emailBaseUrl(originUrl)
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
				this.logger.error(`User invitation could not be sent: ${describeEmailSendError(error)}`);
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
				host: this.emailBaseUrl(originUrl)
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
				this.logger.error(`Team invitation could not be sent: ${describeEmailSendError(error)}`);
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
				host: this.emailBaseUrl(originUrl)
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
				this.logger.error(`Employee invitation could not be sent: ${describeEmailSendError(error)}`);
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
				host: this.emailBaseUrl(originUrl),
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
				this.logger.error(`Invitation acceptance email could not be sent: ${describeEmailSendError(error)}`);
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

		// Override the default config by merging in the provided values - except links on an origin
		// this deployment does not serve, which keep the configured value.
		const appIntegration = deepMerge(
			env.appIntegrationConfig,
			this.withAllowedLinks(integration, EmailTemplateEnum.WELCOME_USER)
		);

		const sendOptions = {
			template: EmailTemplateEnum.WELCOME_USER,
			message: {
				to: `${user.email}`
			},
			locals: {
				locale: languageCode,
				email: user.email,
				host: this.emailBaseUrl(originUrl),
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
					this.logger.error(`Welcome email could not be sent: ${describeEmailSendError(error)}`);
				} finally {
					await this.createEmailRecord(body);
				}
			}
		} catch (error) {
			this.logger.error(`Welcome email could not be prepared: ${describeEmailSendError(error)}`);
		}
	}

	/**
	 * Send the email-verification link and code.
	 *
	 * Every attempt is now recorded in `email_sent` with `status` SENT or FAILED, and a failure is
	 * logged with the provider's error code and message (addresses masked) - until now a failed
	 * verification send left no row and only an unlabelled `console.error`, so a provider-side outage
	 * was invisible. The recorded row deliberately keeps the subject only: the body carries a live
	 * verification link and code, and `email_sent` content is readable (and re-sendable) from the
	 * tenant's email history.
	 *
	 * @param user The user to verify.
	 * @param verificationLink The link carrying the verification token.
	 * @param verificationCode The alternative code.
	 * @param integration Branding / link overrides for the template.
	 * @returns true when the provider accepted the message, false when it was not sent.
	 */
	async emailVerification(
		user: IUser,
		verificationLink: string,
		verificationCode: string,
		integration: IAppIntegrationConfig
	): Promise<boolean> {
		const { email, firstName, lastName, preferredLanguage } = user;
		const name = [firstName, lastName].filter(Boolean).join(' ') || email;
		// The template lookup falls back to English when the locale has no template; the record
		// needs a concrete language too, or its template lookup matches whichever row comes first.
		const languageCode = (preferredLanguage as LanguagesEnum) || LanguagesEnum.ENGLISH;

		/**
		 * Email template email options
		 */
		const sendOptions = {
			template: EmailTemplateEnum.EMAIL_VERIFICATION,
			message: {
				to: `${email}`,
				headers: NO_LINK_TRACKING_HEADERS
			},
			locals: {
				name,
				email,
				verificationLink,
				verificationCode,
				...integration,
				locale: languageCode,
				host: env.clientBaseUrl
			}
		};

		if (DISALLOW_EMAIL_SERVER_DOMAIN.some((server) => email.includes(server))) {
			this.logger.warn(`Verification email for user ${user.id} not sent: the recipient domain is blocked.`);
			return false;
		}

		let subject: string | undefined;
		let status = EmailStatusEnum.FAILED;
		try {
			const instance = await this.emailSendService.getInstance();
			const send = await instance.send(sendOptions);

			subject = send?.originalMessage?.subject;
			status = EmailStatusEnum.SENT;
			return true;
		} catch (error) {
			this.logger.error(
				`Verification email for user ${user.id} could not be sent: ${describeEmailSendError(error)}`
			);
			return false;
		} finally {
			await this.createEmailRecord({
				templateName: sendOptions.template,
				email,
				languageCode,
				// Subject only - see the method comment.
				message: { subject },
				user,
				status
			});
		}
	}

	/**
	 * Whether the provider accepted a verification email for this user at or after `since`.
	 *
	 * Reads the `email_sent` rows written by {@link emailVerification}, which records every attempt
	 * with status SENT or FAILED. Only a SENT row counts: the app must not tell anyone "we sent you a
	 * link" when no link went out - users created before verification existed (or whose sign-up mail
	 * was lost) have never been sent one. Never throws; an unreadable history answers false, so the
	 * caller offers to send a link instead of promising one.
	 *
	 * @param userId The user the verification email was for.
	 * @param since Oldest send that still counts (the start of the link's validity window).
	 */
	async hasSentVerificationEmail(userId: ID, since: Date): Promise<boolean> {
		try {
			return await this.typeOrmEmailHistoryRepository.exists({
				where: {
					userId,
					status: EmailStatusEnum.SENT,
					createdAt: MoreThanOrEqual(since),
					emailTemplate: { name: `${EmailTemplateEnum.EMAIL_VERIFICATION}/html` }
				}
			});
		} catch (error) {
			this.logger.error(
				`Could not read the verification emails of user ${userId}: ${describeEmailSendError(error)}`
			);
			return false;
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
			message: { to: email, headers: NO_LINK_TRACKING_HEADERS },
			locals: {
				...integration,
				userName: name,
				tenantName: tenant?.name, // Tenant is optional
				locale: languageCode,
				generatedUrl: resetLink,
				host: this.emailBaseUrl(originUrl)
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
			this.logger.error(`Password reset email could not be sent: ${describeEmailSendError(error)}`);
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
			message: { to: email, headers: NO_LINK_TRACKING_HEADERS },
			locals: {
				...integration,
				locale: languageCode,
				host: this.emailBaseUrl(originUrl),
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
			this.logger.error(`Multi-tenant password reset email could not be sent: ${describeEmailSendError(error)}`);
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
				host: this.emailBaseUrl(originUrl),
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
				this.logger.error(`Appointment email could not be sent: ${describeEmailSendError(error)}`);
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
				this.logger.error(`Timesheet action email could not be sent: ${describeEmailSendError(error)}`);
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
				this.logger.error(`Timesheet submission email could not be sent: ${describeEmailSendError(error)}`);
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
				to: `${email}`,
				headers: NO_LINK_TRACKING_HEADERS
			},
			locals: {
				locale,
				email,
				magicCode,
				magicLink,
				...this.withAllowedLinks(integration, EmailTemplateEnum.PASSWORD_LESS_AUTHENTICATION)
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
				// Get the email sending service instance (tenant-scoped with fallback to the default transporter)
				const instance = await this.emailSendService.getEmailInstance({
					tenantId: RequestContext.currentTenantId()
				});
				// Send the email
				const send = await instance.send(sendOptions);
				// Update the body with the original message
				body['message'] = send.originalMessage;
			} catch (error) {
				this.logger.error(`Magic login code email could not be sent: ${describeEmailSendError(error)}`);
			} finally {
				await this.createEmailRecord(body);
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
				this.logger.error(`Email reset code could not be sent: ${describeEmailSendError(error)}`);
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
				...this.withAllowedLinks(integration, EmailTemplateEnum.ORGANIZATION_TEAM_JOIN_REQUEST)
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
				this.logger.error(`Team join request email could not be sent: ${describeEmailSendError(error)}`);
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
		const clientBaseUrl = this.emailBaseUrl(originUrl);

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
				this.logger.error(`Candidate rejection email could not be sent: ${describeEmailSendError(error)}`);
				throw new BadRequestException(
					`Error while sending rejection email to ${candidateName}: ${error?.message}`
				);
			} finally {
				await this.createEmailRecord(body);
			}
		}
	}

	/**
	 * Resend an email based on the provided email history ID, input details, and language code.
	 *
	 * @param id - The unique identifier of the email history record.
	 * @param input - The input object containing organization and tenant details for resending the email.
	 * @param languageCode - The language code used for localizing email content (if applicable).
	 * @returns A promise that resolves to the updated email history record.
	 */
	async resendEmail(id: ID, input: IResendEmailInput, languageCode: LanguagesEnum): Promise<IEmailHistory> {
		// The tenant comes from the authenticated request, never from the body: this is a raw
		// repository lookup (no TenantAwareCrudService scoping), and a missing/null body tenantId
		// would otherwise drop the tenant predicate entirely (GHSA-44pv-34gx-q9p4 class).
		const tenantId = RequestContext.currentTenantId();
		const { organizationId } = input;

		// Fetch the email history record with its associated email template and organization.
		const emailHistory = await this.typeOrmEmailHistoryRepository.findOne({
			where: { id, tenantId, ...(organizationId ? { organizationId } : {}) },
			relations: { emailTemplate: true, organization: true }
		});

		// Throw an exception if the email history record is not found.
		if (!emailHistory) {
			throw new NotFoundException('Email History does not exist');
		}

		// Extract organization and email details.
		const { organization } = emailHistory;
		const email = emailHistory.email;

		// Construct email send options.
		const sendOptions = {
			template: emailHistory.emailTemplate.name,
			message: {
				to: email,
				subject: emailHistory.name,
				html: emailHistory.content
			}
		};

		// Check if the recipient email is blocked based on domain restrictions.
		const isEmailBlocked = DISALLOW_EMAIL_SERVER_DOMAIN.some((server) => sendOptions.message.to.includes(server));
		if (isEmailBlocked) {
			throw new BadRequestException(`Email address ${sendOptions.message.to} is blocked by domain restrictions.`);
		}

		try {
			// Retrieve the email instance for the organization and tenant.
			const instance = await this.emailSendService.getEmailInstance({
				organizationId: organization.id,
				tenantId: emailHistory.tenantId
			});

			// Attempt to send the email.
			await instance.send(sendOptions);

			// Update the email history status to SENT.
			emailHistory.status = EmailStatusEnum.SENT;
			return await this.typeOrmEmailHistoryRepository.save(emailHistory);
		} catch (error) {
			this.logger.error(`Email history ${id} could not be re-sent: ${describeEmailSendError(error)}`);

			// Update the email history status to FAILED and save.
			emailHistory.status = EmailStatusEnum.FAILED;
			await this.typeOrmEmailHistoryRepository.save(emailHistory);

			// Propagate the error wrapped in a BadRequestException.
			throw new BadRequestException(`Error while re-sending mail: ${error?.message}`);
		}
	}

	/**
	 * Record an attempted send in `email_sent`.
	 *
	 * `status` is taken from the caller when given. Otherwise it is inferred: every sender in this
	 * service stores the provider's `originalMessage` (an object) on success only and leaves the
	 * initial `''` on failure, so an object means SENT and anything else FAILED. Rows written before
	 * this change have a NULL status.
	 *
	 * The template lookup falls back to English, matching the renderer: a locale with no template of
	 * its own is sent in English, and `emailTemplateId` is NOT NULL, so without the fallback the row
	 * could not be saved at all.
	 *
	 * Never throws. It runs in the senders' `finally` blocks, where an exception would replace the
	 * send's own outcome - a delivered email reported as a 500, or the real send error hidden behind
	 * a bookkeeping one.
	 */
	private async createEmailRecord(createEmailOptions: {
		templateName: string;
		email: string;
		languageCode: LanguagesEnum;
		message: any;
		organization?: IOrganization;
		user?: IUser;
		status?: EmailStatusEnum;
	}): Promise<IEmailHistory | null> {
		const { templateName: template, email, languageCode, message, organization, user } = createEmailOptions;
		try {
			const emailEntity = new EmailHistory();
			const tenantId = organization ? organization.tenantId : RequestContext.currentTenantId();
			const status =
				createEmailOptions.status ??
				(message && typeof message === 'object' ? EmailStatusEnum.SENT : EmailStatusEnum.FAILED);

			let emailTemplate = await this.typeOrmEmailTemplateRepository.findOneBy({
				name: template + '/html',
				languageCode: languageCode || LanguagesEnum.ENGLISH
			});
			if (!emailTemplate && languageCode !== LanguagesEnum.ENGLISH) {
				emailTemplate = await this.typeOrmEmailTemplateRepository.findOneBy({
					name: template + '/html',
					languageCode: LanguagesEnum.ENGLISH
				});
			}

			emailEntity.name = message?.subject;
			emailEntity.email = email;
			emailEntity.content = message?.html;
			emailEntity.status = status;
			emailEntity.emailTemplate = emailTemplate;
			emailEntity.tenantId = tenantId;
			emailEntity.organizationId = organization ? organization.id : null;
			if (user) {
				emailEntity.user = user;
			}
			return await this.typeOrmEmailHistoryRepository.save(emailEntity);
		} catch (error) {
			this.logger.error(
				`Could not record the "${template}" email in email_sent: ${describeEmailSendError(error)}`
			);
			return null;
		}
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
