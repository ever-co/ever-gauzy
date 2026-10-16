// cspell:ignore svix whsec
import {
	Inject,
	Injectable,
	Logger,
	OnModuleDestroy,
	OnModuleInit,
	Optional,
	UnauthorizedException
} from '@nestjs/common';
import { INBOX_EMAIL_PROVIDER_REGISTRY } from '@gauzy/contracts';
import {
	IEmailProviderPlugin,
	IEmailProviderRegistry,
	IInboundEmailProvider,
	IInboundWebhookRequest,
	InboundReplayGuard,
	IParsedInboundAttachment,
	IProviderAccountContext,
	messageIdOf,
	parseMimeMessage,
	ParsedInboundEmail,
	referencesOf,
	safeFilename
} from '@gauzy/plugin-inbox';
import { FetchLike, ResendApiClient, ResendApiError, ResendReceivedEmail } from './resend-api.client';
import { createResendTransport } from './resend-transport';
import {
	SVIX_ID_HEADER,
	SVIX_SIGNATURE_HEADER,
	SVIX_TIMESTAMP_HEADER,
	SVIX_TOLERANCE_SECONDS,
	verifySvixSignature
} from './svix-signature';

/** The token a spec (or another runtime) replaces the HTTP client's `fetch` with. */
export const RESEND_FETCH = 'RESEND_FETCH';

/** The webhook events that carry received mail. */
export const RESEND_RECEIVED_EVENT = 'email.received';

const header = (request: IInboundWebhookRequest, name: string): string | undefined => {
	const value = request.headers[name];
	return Array.isArray(value) ? value[0] : value;
};

/** `"Name <a@b>"` / `"a@b"` → `{ address, name? }`. */
function address(value: unknown): { address: string; name?: string } | undefined {
	if (typeof value !== 'string' || !value.includes('@')) return undefined;
	const match = /^\s*"?([^"<]*?)"?\s*<([^<>]+)>\s*$/.exec(value);
	if (!match) return { address: value.trim() };
	const name = (match[1] as string).trim();
	return name ? { address: (match[2] as string).trim(), name } : { address: (match[2] as string).trim() };
}

const addresses = (values: unknown): Array<{ address: string; name?: string }> =>
	(Array.isArray(values) ? values : typeof values === 'string' ? [values] : [])
		.map(address)
		.filter((entry): entry is { address: string; name?: string } => !!entry);

/**
 * Resend (plan 04 §5.2, G-P4-4): the reference email provider plugin.
 *
 * - **Inbound.** Resend posts an `email.received` webhook (Svix-signed: `svix-id`, `svix-timestamp`,
 *   `svix-signature`, HMAC-SHA256 under the account's `whsec_` secret, 5-minute window, single use per `svix-id`). The
 *   event carries metadata only, so the plugin fetches the message from the Receiving API with the account's API key
 *   (`GET /emails/receiving/:id`), and its attachments (`…/attachments`: short-lived signed URLs). When Resend offers
 *   the raw message, that is parsed instead. The webhook's recipients are the envelope.
 * - **Outbound.** A nodemailer transport over `POST /emails` for the core transport seam.
 * - **Test connection.** `GET /domains` with the API key (a sending-only key is reported as valid but restricted).
 *
 * The plugin registers with the Inbox email provider registry when that is loaded (`GAUZY_INBOX_EMAIL_ENABLED=true`);
 * otherwise it stays idle.
 */
@Injectable()
export class ResendProvider implements IEmailProviderPlugin, IInboundEmailProvider, OnModuleInit, OnModuleDestroy {
	readonly id = 'resend';
	readonly displayName = 'Resend';
	readonly description = 'Receive with Resend inbound (email.received webhooks) and send through the Resend API.';
	readonly capabilities = { inbound: true, outbound: true, customDomains: true };
	readonly configSchema = {
		type: 'object' as const,
		properties: {
			apiKey: {
				type: 'string' as const,
				title: 'API key',
				description:
					'A Resend API key (re_…). Full access for receiving and the connection test; sending access is enough to send.',
				writeOnly: true,
				pattern: '^re_[A-Za-z0-9_]+$'
			},
			webhookSecret: {
				type: 'string' as const,
				title: 'Webhook signing secret',
				description:
					'The signing secret (whsec_…) of the Resend webhook that posts email.received to the account URL.',
				writeOnly: true,
				pattern: '^whsec_[A-Za-z0-9+/=]+$'
			},
			fromAddress: {
				type: 'string' as const,
				title: 'Default sender',
				description: 'An address on a domain verified at Resend, for mail that names no sender.',
				format: 'email' as const
			}
		},
		required: ['apiKey']
	};
	readonly inbound: IInboundEmailProvider = this;
	private readonly logger = new Logger(ResendProvider.name);

	constructor(
		@Optional() @Inject(INBOX_EMAIL_PROVIDER_REGISTRY) private readonly registry?: IEmailProviderRegistry,
		@Optional() @Inject(InboundReplayGuard) private readonly replay?: InboundReplayGuard,
		@Optional() @Inject(RESEND_FETCH) private readonly fetcher?: FetchLike
	) {}

	onModuleInit(): void {
		if (!this.registry) {
			this.logger.warn(
				'The Inbox email features are off (GAUZY_INBOX_EMAIL_ENABLED): the Resend provider stays idle.'
			);
			return;
		}
		this.registry.register(this);
	}

	onModuleDestroy(): void {
		this.registry?.unregister(this.id);
	}

	async verify(request: IInboundWebhookRequest, account: IProviderAccountContext): Promise<void> {
		const secret =
			typeof account.config['webhookSecret'] === 'string' ? (account.config['webhookSecret'] as string) : '';
		const id = header(request, SVIX_ID_HEADER);
		const valid =
			!!secret &&
			!!request.rawBody?.length &&
			verifySvixSignature(
				secret,
				{
					id,
					timestamp: header(request, SVIX_TIMESTAMP_HEADER),
					signature: header(request, SVIX_SIGNATURE_HEADER)
				},
				request.rawBody.toString('utf8')
			);
		if (!valid) {
			throw new UnauthorizedException('The Resend webhook is not signed with this account’s secret.');
		}
		// Single use of this exact delivery (id + timestamp): Resend re-signs a retry with a new timestamp, so a retry
		// after a failure is never refused, while a captured request replayed as it was is.
		const timestamp = header(request, SVIX_TIMESTAMP_HEADER);
		if (
			this.replay &&
			!(await this.replay.consume(
				`resend:${account.id}`,
				`${id}.${timestamp}`,
				(2 * SVIX_TOLERANCE_SECONDS + 60) * 1000
			))
		) {
			throw new UnauthorizedException('The Resend webhook was already received.');
		}
	}

	async parse(request: IInboundWebhookRequest, account: IProviderAccountContext): Promise<ParsedInboundEmail[]> {
		const event = (request.body ?? {}) as { type?: unknown; data?: Record<string, unknown> };
		if (event.type !== RESEND_RECEIVED_EVENT || !event.data) {
			// Another event type (deliveries, bounces): nothing to store.
			return [];
		}
		const emailId = typeof event.data['email_id'] === 'string' ? (event.data['email_id'] as string) : '';
		if (!emailId) return [];
		const envelopeRecipients = addresses(event.data['to']).map((entry) => entry.address);
		const client = this.client(account);
		const email = await client.receivedEmail(emailId);
		const receivedAt = new Date(String(email.created_at ?? event.data['created_at'] ?? Date.now()));
		const when = Number.isNaN(receivedAt.getTime()) ? new Date() : receivedAt;

		if (email.raw?.download_url) {
			const raw = await client.download(email.raw.download_url);
			return [await parseMimeMessage(raw, { envelopeRecipients, receivedAt: when, providerMessageId: emailId })];
		}
		return [await this.fromReceivedEmail(client, email, envelopeRecipients, when)];
	}

	createTransport(account: IProviderAccountContext): unknown {
		const from =
			typeof account.config['fromAddress'] === 'string' ? (account.config['fromAddress'] as string) : undefined;
		return createResendTransport(this.client(account), from);
	}

	async verifyAccount(
		account: IProviderAccountContext
	): Promise<{ ok: boolean; message?: string; details?: Record<string, unknown> }> {
		try {
			const domains = await this.client(account).listDomains();
			const verified = domains.filter((domain) => domain.status === 'verified').map((domain) => domain.name);
			return {
				ok: true,
				message: `Connected. ${verified.length} verified domain(s) of ${domains.length}.`,
				details: { verifiedDomains: verified }
			};
		} catch (error) {
			if (error instanceof ResendApiError && (error.status === 401 || error.code === 'restricted_api_key')) {
				return error.code === 'restricted_api_key'
					? {
							ok: true,
							message: 'The key is valid but restricted to sending: receiving needs a full-access key.'
						}
					: { ok: false, message: 'Resend refused the API key.' };
			}
			return {
				ok: false,
				message: error instanceof Error ? error.message.slice(0, 300) : 'The connection test failed.'
			};
		}
	}

	private client(account: IProviderAccountContext): ResendApiClient {
		const apiKey = typeof account.config['apiKey'] === 'string' ? (account.config['apiKey'] as string) : '';
		return new ResendApiClient(apiKey, this.fetcher ?? undefined);
	}

	/** A received email (JSON) and its downloaded attachments, as the normalized message. */
	private async fromReceivedEmail(
		client: ResendApiClient,
		email: ResendReceivedEmail,
		envelopeRecipients: string[],
		receivedAt: Date
	): Promise<ParsedInboundEmail> {
		const headers: Record<string, string> = {};
		for (const [name, value] of Object.entries(email.headers ?? {})) {
			if (typeof value === 'string') headers[name.toLowerCase()] = value.slice(0, 1000);
		}
		const listed = (email.attachments ?? []).length > 0 ? await client.receivedAttachments(email.id) : [];
		const attachments: IParsedInboundAttachment[] = [];
		for (const attachment of listed.slice(0, 50)) {
			if (!attachment.download_url) continue;
			const content = await client.download(attachment.download_url);
			attachments.push({
				filename: safeFilename(attachment.filename),
				...(attachment.content_type ? { contentType: attachment.content_type } : {}),
				size: content.length,
				content,
				...(attachment.content_id ? { contentId: attachment.content_id.replace(/^<|>$/g, '') } : {}),
				isInline: attachment.content_disposition === 'inline'
			});
		}
		const from = address(email.from);
		const html = typeof email.html === 'string' ? email.html : undefined;
		const text = typeof email.text === 'string' ? email.text : undefined;
		const messageId = messageIdOf(email.message_id) ?? messageIdOf(`${email.id}@resend.invalid`);
		const inReplyTo = messageIdOf(headers['in-reply-to']);
		return {
			...(messageId ? { messageId } : {}),
			providerMessageId: email.id,
			...(from ? { from } : {}),
			to: addresses(email.to),
			cc: addresses(email.cc),
			replyTo: addresses(email.reply_to),
			envelopeRecipients,
			...(email.subject ? { subject: email.subject } : {}),
			...(text ? { text } : {}),
			...(html ? { html } : {}),
			...(inReplyTo ? { inReplyTo } : {}),
			references: referencesOf(headers['references']),
			headers,
			receivedAt,
			sizeBytes:
				(text?.length ?? 0) + (html?.length ?? 0) + attachments.reduce((sum, part) => sum + part.size, 0),
			attachments
		};
	}
}
