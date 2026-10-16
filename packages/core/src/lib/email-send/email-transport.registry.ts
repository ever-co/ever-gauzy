import { Injectable, Logger } from '@nestjs/common';
import { ID } from '@gauzy/contracts';
import { describeEmailSendError } from './email-send-error';

/**
 * The email transport seam (plan 04 §5.5, G-P4-5).
 *
 * Gauzy sends over SMTP: the organization's Custom SMTP, then the tenant's, then the `MAIL_*` settings. A provider
 * plugin (Resend, Postmark, Mailgun, SendGrid, Amazon SES, ...) can supply an API transport instead, through a
 * resolver registered here. `EmailSendService` asks the registry first and falls back to that SMTP chain when no
 * resolver answers, so an installation with no resolver registered (every one today: each provider plugin is
 * behind its own flag, off by default) sends exactly as before.
 *
 * The order of plan 04 §5.5 is the resolvers' business: the Inbox registers one resolver that answers, in turn,
 * the provider account of the mailbox a reply is sent from, the organization's selected outbound account and the
 * tenant's. Custom SMTP and `MAIL_*` stay where they are, in `EmailSendService`.
 */

/** What a sender knows when it asks for a transport. */
export interface IEmailTransportRequest {
	tenantId?: ID | null;
	organizationId?: ID | null;
	/**
	 * The provider account to send through, when the sender has one in mind: an Inbox reply names the account of
	 * the mailbox it is sent from (plan 04 §5.5, step 1).
	 */
	providerAccountId?: ID | null;
}

/** A transport a resolver supplies. */
export interface IEmailTransportResolution {
	/**
	 * A nodemailer transport: a transporter (it has `sendMail`), a custom transport object (`{ name, version,
	 * send(mail, callback) }`) or transport options. `email-templates` hands anything but a transporter to
	 * `nodemailer.createTransport`.
	 */
	transport: unknown;
	/** The address the account sends as by default; a message's own `from` wins over it. */
	fromAddress?: string | null;
	/** Which resolver and account answered, for logs and the sent-mail record. Never a secret. */
	source: string;
}

/** Supplies transports for some requests (a provider plugin, the Inbox). */
export interface IEmailTransportResolver {
	/** Unique among the registered resolvers. */
	readonly id: string;
	/**
	 * The transport for a request, or `null` when this resolver has none for it (the next resolver, then the SMTP
	 * chain, is asked). A resolver that throws is logged and skipped, so a broken provider account never stops
	 * transactional mail: it goes out over SMTP as it did before the account existed.
	 */
	resolve(request: IEmailTransportRequest): Promise<IEmailTransportResolution | null>;
}

/** The resolvers a sender consults before the SMTP chain, in registration order. */
@Injectable()
export class EmailTransportRegistry {
	private readonly logger = new Logger(EmailTransportRegistry.name);
	private readonly resolvers = new Map<string, IEmailTransportResolver>();

	/**
	 * Adds a resolver. Registering the same resolver again is a no-op; a different resolver under a taken id is
	 * refused, so two plugins never silently replace each other.
	 */
	register(resolver: IEmailTransportResolver): void {
		const id = typeof resolver?.id === 'string' ? resolver.id.trim() : '';
		if (!id || typeof resolver.resolve !== 'function') {
			throw new Error('An email transport resolver needs an id and a resolve function.');
		}
		const current = this.resolvers.get(id);
		if (current && current !== resolver) {
			throw new Error(`An email transport resolver is already registered as ${id}.`);
		}
		this.resolvers.set(id, resolver);
		this.logger.log(`Email transport resolver registered: ${id}`);
	}

	/** Removes a resolver (a plugin that is shutting down). The id is trimmed, as `register` stores it. */
	unregister(id: string): void {
		this.resolvers.delete(typeof id === 'string' ? id.trim() : id);
	}

	/** The registered resolver ids (diagnostics). */
	ids(): string[] {
		return [...this.resolvers.keys()];
	}

	/** How many resolvers are registered: none means every send takes the SMTP chain. */
	get size(): number {
		return this.resolvers.size;
	}

	/**
	 * The first transport a resolver supplies for the request, or `null` (then the sender uses SMTP).
	 * A resolver that throws or answers something that is not a transport is logged and skipped.
	 */
	async resolve(request: IEmailTransportRequest): Promise<IEmailTransportResolution | null> {
		if (this.resolvers.size === 0) {
			return null;
		}
		for (const [id, resolver] of [...this.resolvers.entries()]) {
			try {
				const resolution = await resolver.resolve({ ...request });
				if (!resolution) {
					continue;
				}
				if (!resolution.transport || typeof resolution.transport !== 'object') {
					this.logger.warn(`Email transport resolver ${id} answered without a transport; skipped.`);
					continue;
				}
				return { ...resolution, source: resolution.source || id };
			} catch (error) {
				// Log-safe: a provider's error text can carry addresses, so they are masked.
				this.logger.warn(
					`Email transport resolver ${id} failed; trying the next transport: ${describeEmailSendError(error)}`
				);
			}
		}
		return null;
	}
}

/**
 * The registry of this process. `EmailSendModule` provides this instance, so a plugin reaches the same registry
 * whether it injects `EmailTransportRegistry` (importing `EmailSendModule`) or calls this function.
 */
const processRegistry = new EmailTransportRegistry();

export function getEmailTransportRegistry(): EmailTransportRegistry {
	return processRegistry;
}
