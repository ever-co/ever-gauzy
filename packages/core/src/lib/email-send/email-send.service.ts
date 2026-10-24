import {
	BadRequestException,
	Injectable,
	InternalServerErrorException,
	Logger,
	NotFoundException,
	Optional
} from '@nestjs/common';
import { IsNull } from 'typeorm';
import * as Email from 'email-templates';
import { ISMTPConfig } from '@gauzy/common';
import { ID, IBasePerTenantAndOrganizationEntityModel, IVerifySMTPTransport } from '@gauzy/contracts';
import { isEmpty } from '@gauzy/utils';
import { CustomSmtp } from './../core/entities/internal';
import { RequestContext } from './../core/context';
import { CustomSmtpService } from './../custom-smtp/custom-smtp.service';
import { SMTPUtils } from './utils';
import { EmailTemplateRenderService } from './email-template-render.service';
import {
	EmailTransportRegistry,
	getEmailTransportRegistry,
	IEmailTransportRequest,
	IEmailTransportResolution
} from './email-transport.registry';

/** The sender when neither the transport nor `MAIL_FROM_ADDRESS` names one (one literal: the egress baseline counts it). */
const DEFAULT_FROM_ADDRESS = 'noreply@gauzy.co';

/** An address as nodemailer takes it. */
export type OutboundEmailAddress = string | { name?: string; address: string };

/**
 * A message no template renders, which a plugin sends through the platform's transports: an Inbox reply or
 * forward (plan 04 §5.5). The fields are nodemailer's message fields.
 */
export interface IOutboundEmailMessage {
	/** Defaults to the transport's own address (the provider account's, Custom SMTP's or `MAIL_FROM_ADDRESS`). */
	from?: OutboundEmailAddress;
	to: OutboundEmailAddress | OutboundEmailAddress[];
	cc?: OutboundEmailAddress | OutboundEmailAddress[];
	bcc?: OutboundEmailAddress | OutboundEmailAddress[];
	replyTo?: OutboundEmailAddress | OutboundEmailAddress[];
	subject: string;
	text?: string;
	html?: string;
	/** RFC 5322 threading: the `Message-ID` this message answers, and the thread's `References`. */
	inReplyTo?: string;
	references?: string | string[];
	/** The `Message-ID` to send with (nodemailer generates one when absent). */
	messageId?: string;
	headers?: Record<string, string>;
	attachments?: Array<{
		filename: string;
		content: Buffer | string;
		contentType?: string;
		/** Inline attachments are referenced from the HTML as `cid:<cid>`. */
		cid?: string;
	}>;
}

/** Whom a message is sent for, and through which provider account if the sender has one in mind. */
export interface IOutboundEmailScope extends IEmailTransportRequest {
	tenantId: ID;
}

/** What the transport said about a sent message. */
export interface IOutboundEmailResult {
	/** The `Message-ID` the message went out with. */
	messageId: string | null;
	accepted: string[];
	rejected: string[];
	/** `provider:<resolution source>` when a resolver's transport sent it, `smtp` for the SMTP chain. */
	transport: string;
	/** The provider's own id for the message, when its transport reports one (`info.providerMessageId`). */
	providerMessageId?: string | null;
}

/** The addresses of a nodemailer result list (strings or `{ address }` objects). */
function addressesOf(list: unknown): string[] {
	if (!Array.isArray(list)) {
		return [];
	}
	return list
		.map((entry) => (typeof entry === 'string' ? entry : (entry as { address?: string })?.address))
		.filter((address): address is string => typeof address === 'string' && address.length > 0);
}

/**
 * The transport a stored SMTP configuration describes, whichever ORM read it.
 *
 * On TypeORM the configuration is a `CustomSmtp` and carries `getSmtpTransporter`, which is called exactly as it
 * always was. On MikroORM `CustomSmtpService.findOneByOptions` answers the CRUD base's `wrap(entity).toJSON()` — the
 * row's data without the entity's prototype — so the call failed with `getSmtpTransporter is not a function`: with an
 * organization's own configuration no e-mail was sent at all (the error left `getEmailInstance` answering nothing),
 * and with only a tenant's the error was swallowed and mail went out through the platform's default server instead.
 * The method reads only the row's columns, so it is run on the serialized row as `CustomSmtp`'s own.
 *
 * @param smtp The configuration, as the CRUD base answered it.
 * @returns The SMTP transport configuration.
 */
function smtpConfigOf(smtp: CustomSmtp): ISMTPConfig {
	if (typeof smtp.getSmtpTransporter === 'function') {
		return smtp.getSmtpTransporter();
	}

	return CustomSmtp.prototype.getSmtpTransporter.call(smtp);
}

@Injectable()
export class EmailSendService {
	private readonly logger = new Logger(EmailSendService.name);
	private readonly transportRegistry: EmailTransportRegistry;

	constructor(
		private readonly customSmtpService: CustomSmtpService,
		private readonly emailTemplateRenderService: EmailTemplateRenderService,
		// The process's registry (`EmailSendModule` provides it); a caller that builds the service by hand gets it too.
		@Optional() transportRegistry?: EmailTransportRegistry
	) {
		this.transportRegistry = transportRegistry ?? getEmailTransportRegistry();
	}

	/**
	 * Retrieves an instance of the `Email` class by verifying the default SMTP transporter.
	 *
	 * - Fetches the default SMTP configuration.
	 * - Converts the SMTP configuration to a transporter.
	 * - Verifies the transporter.
	 * - Returns an email instance if the transporter is valid.
	 * - Throws an error if the verification fails.
	 *
	 * @returns {Promise<Email<any>>} A promise that resolves to an Email instance.
	 * @throws {InternalServerErrorException} If there is an error while retrieving or verifying the SMTP configuration.
	 */
	public async getInstance(): Promise<Email<any>> {
		try {
			// Fetch the default SMTP configuration
			const smtpConfig: ISMTPConfig = SMTPUtils.defaultSMTPTransporter();

			// Convert SMTP configuration to a transport object
			const transport: IVerifySMTPTransport = SMTPUtils.convertSmtpToTransporter(smtpConfig);

			// console.log('Default SMTP configuration: %s', transport);

			// Verify the SMTP transporter
			if (!!(await SMTPUtils.verifyTransporter(transport))) {
				// Return an Email instance with the validated SMTP configuration
				return this.getEmailConfig(smtpConfig);
			}

			// A transport that fails verification used to fall through and return `undefined`, so
			// every caller then died on `instance.send` with a TypeError that said nothing about SMTP.
			throw new Error('The default SMTP transport failed verification (check the MAIL_* settings).');
		} catch (error) {
			// Log and throw an internal server error
			console.log('Error while retrieving default global smtp configuration: %s', error?.message);
			throw new InternalServerErrorException(error);
		}
	}

	/**
	 * The `Email` instance a tenant's / organization's mail is sent with.
	 *
	 * A transport a provider plugin supplies through the `EmailTransportRegistry` comes first (plan 04 §5.5); with
	 * none registered, or none answering for this tenant / organization, it is the SMTP chain as it always was: the
	 * organization's Custom SMTP, then the tenant's, then the `MAIL_*` settings.
	 *
	 * @param param0 The tenant and organization, and the provider account when the sender has one in mind.
	 */
	public async getEmailInstance({
		organizationId,
		tenantId = RequestContext.currentTenantId(),
		providerAccountId
	}: IBasePerTenantAndOrganizationEntityModel & { providerAccountId?: ID | null }) {
		// A templated mail goes out as the transport's default sender: a provider account without its own would send
		// as `MAIL_FROM_ADDRESS`, which the provider refuses, so only one with a sender is used (review F63).
		const provided = await this.providerEmailInstance({
			tenantId,
			organizationId,
			providerAccountId,
			requireFromAddress: true
		});
		if (provided) {
			return provided.email;
		}
		return this.smtpEmailInstance({ organizationId, tenantId });
	}

	/**
	 * Sends a message no template renders (an Inbox reply or forward) through the same transports as
	 * `getEmailInstance`: a provider's first, then the SMTP chain.
	 *
	 * @param message The message (nodemailer fields).
	 * @param scope The tenant (required), the organization and the provider account.
	 * @returns The `Message-ID`, the accepted / rejected recipients and which transport sent it.
	 * @throws The transport's error when the send fails (the caller records it).
	 */
	public async sendMessage(
		message: IOutboundEmailMessage,
		scope: IOutboundEmailScope
	): Promise<IOutboundEmailResult> {
		if (!scope?.tenantId) {
			throw new BadRequestException('An email needs the tenant it is sent for.');
		}
		if (!message || typeof message.subject !== 'string') {
			throw new BadRequestException('An email needs a subject.');
		}
		const provided = await this.providerEmailInstance(scope);
		const email =
			provided?.email ??
			(await this.smtpEmailInstance({
				tenantId: scope.tenantId,
				organizationId: scope.organizationId ?? undefined
			}));
		if (!email) {
			throw new InternalServerErrorException('No email transport is configured for this tenant / organization.');
		}

		const info: any = await email.send({ message: { ...message } });
		return {
			messageId: typeof info?.messageId === 'string' ? info.messageId : null,
			accepted: addressesOf(info?.accepted),
			rejected: addressesOf(info?.rejected),
			transport: provided ? `provider:${provided.source}` : 'smtp',
			providerMessageId: typeof info?.providerMessageId === 'string' ? info.providerMessageId : null
		};
	}

	/**
	 * The `Email` instance of the transport a registered resolver supplies, or `null` (no resolver, or none has a
	 * transport for this request). With no resolver registered this answers at once and reads nothing.
	 */
	private async providerEmailInstance(
		request: IEmailTransportRequest
	): Promise<{ email: Email<any>; source: string } | null> {
		if (this.transportRegistry.size === 0) {
			return null;
		}
		const resolution = await this.transportRegistry.resolve(request);
		if (!resolution) {
			return null;
		}
		if (request.requireFromAddress && !resolution.fromAddress) {
			this.logger.debug(`Email transport ${resolution.source} has no sender of its own; using SMTP.`);
			return null;
		}
		this.logger.debug(`Email transport: ${resolution.source}`);
		return { email: this.getProviderEmailConfig(resolution), source: resolution.source };
	}

	/**
	 * The SMTP chain: the organization's Custom SMTP, then the tenant's, then the `MAIL_*` settings (unchanged).
	 *
	 * @param param0
	 */
	private async smtpEmailInstance({ organizationId, tenantId }: IBasePerTenantAndOrganizationEntityModel) {
		let smtpTransporter: CustomSmtp;
		try {
			smtpTransporter = await this.customSmtpService.findOneByOptions({
				where: {
					organizationId: isEmpty(organizationId) ? IsNull() : organizationId,
					tenantId: isEmpty(tenantId) ? IsNull() : tenantId
				},
				order: {
					createdAt: 'DESC'
				}
			});
			// console.log('Custom SMTP configuration for organization: %s', smtpTransporter);
			const smtpConfig: ISMTPConfig = smtpConfigOf(smtpTransporter);
			const transport: IVerifySMTPTransport = SMTPUtils.convertSmtpToTransporter(smtpConfig);

			/** Verifies SMTP configuration */
			if (!!(await SMTPUtils.verifyTransporter(transport))) {
				return this.getEmailConfig(smtpConfig);
			} else {
				console.log(
					'SMTP configuration is not set for this tenant / organization: [%s, %s]',
					organizationId,
					tenantId
				);
				throw new BadRequestException('SMTP configuration is not set for this tenant / organization');
			}
		} catch (error) {
			try {
				if (error instanceof NotFoundException) {
					smtpTransporter = await this.customSmtpService.findOneByOptions({
						where: {
							organizationId: IsNull(),
							tenantId: isEmpty(tenantId) ? IsNull() : tenantId
						},
						order: {
							createdAt: 'DESC'
						}
					});
					// console.log('Custom SMTP configuration for tenant: %s', smtpTransporter);

					const smtpConfig: ISMTPConfig = smtpConfigOf(smtpTransporter);
					const transport: IVerifySMTPTransport = SMTPUtils.convertSmtpToTransporter(smtpConfig);

					// /** Verifies SMTP configuration */
					if (!!(await SMTPUtils.verifyTransporter(transport))) {
						return this.getEmailConfig(smtpConfig);
					} else {
						console.log('SMTP configuration is not set for this tenant: %s', organizationId);
						throw new BadRequestException('SMTP configuration is not set for this tenant');
					}
				}
			} catch (error) {
				const smtpConfig: ISMTPConfig = SMTPUtils.defaultSMTPTransporter();
				const transport: IVerifySMTPTransport = SMTPUtils.convertSmtpToTransporter(smtpConfig);

				// console.log('Default SMTP configuration: %s', transport);

				/** Verifies SMTP configuration */
				if (!!(await SMTPUtils.verifyTransporter(transport))) {
					return this.getEmailConfig(smtpConfig);
				} else {
					console.log('Error while retrieving tenant/organization smtp configuration: %s', error?.message);
					throw new InternalServerErrorException(
						'Error while retrieving tenant/organization smtp configuration'
					);
				}
			}
		}
	}

	/**
	 * The `Email` instance of a provider's transport. The same configuration as `getEmailConfig`, with the
	 * provider's transport; the sender is the provider account's address, else `MAIL_FROM_ADDRESS`.
	 *
	 * @param resolution What the resolver supplied.
	 */
	private getProviderEmailConfig(resolution: IEmailTransportResolution): Email<any> {
		const fromAddress =
			resolution.fromAddress || SMTPUtils.defaultSMTPTransporter(false)?.fromAddress || DEFAULT_FROM_ADDRESS;
		return this.buildEmail(resolution.transport, fromAddress);
	}

	/**
	 *
	 * @param smtpConfig
	 * @returns
	 */
	private getEmailConfig(smtpConfig: ISMTPConfig): Email<any> {
		// Single source of truth for transport normalization
		const transport: any = SMTPUtils.buildTransportFromSMTPConfig(smtpConfig);
		return this.buildEmail(transport, smtpConfig.fromAddress || DEFAULT_FROM_ADDRESS);
	}

	/**
	 * The `Email` instance every transport shares: send on, Handlebars views, the platform's renderer.
	 *
	 * @param transport A nodemailer transporter, custom transport or transport options.
	 * @param from The default sender.
	 */
	private buildEmail(transport: any, from: string): Email<any> {
		const config: Email.EmailConfig<any> = {
			message: {
				from
			},
			// if you want to send emails in development or test environments, set options.send to true.
			send: true,
			transport: transport,
			i18n: {},
			views: {
				options: {
					extension: 'hbs'
				}
			},
			render: this.emailTemplateRenderService.render
		};
		/**
		 * TODO: uncomment this after we figure out issues with dev / prod in the environment.*.ts
		 */
		// if (!environment.production && !environment.demo) {
		//     config.preview = {
		//         open: {
		//             app: 'firefox',
		//             wait: false
		//         }
		//     };
		// }
		return new Email(config);
	}
}
