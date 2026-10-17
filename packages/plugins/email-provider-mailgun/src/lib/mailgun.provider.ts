// cspell:ignore Sscore Sflag softfail dmarc
import {
	Inject,
	Injectable,
	Logger,
	OnModuleDestroy,
	OnModuleInit,
	Optional,
	UnauthorizedException
} from '@nestjs/common';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { INBOX_EMAIL_PROVIDER_REGISTRY } from '@gauzy/contracts';
import {
	derivedMessageId,
	formatAddress,
	IEmailProviderPlugin,
	IEmailProviderRegistry,
	IInboundDeliveryIdentity,
	IInboundEmailProvider,
	IInboundWebhookRequest,
	IParsedInboundAttachment,
	IProviderAccountContext,
	InboundForm,
	messageIdOf,
	parseAddressList,
	parseMimeMessage,
	ParsedInboundEmail,
	providerTransport,
	readInboundForm,
	referencesOf,
	safeFilename,
	toVerdict
} from '@gauzy/plugin-inbox';

/** The Mailgun API of each region (https, no redirects). */
export const MAILGUN_API_BASE_URLS = { us: 'https://api.mailgun.net', eu: 'https://api.eu.mailgun.net' } as const;
/** The token a spec replaces `fetch` with. */
export const MAILGUN_FETCH = 'MAILGUN_FETCH';
/**
 * How far a signature's timestamp may be from now. Mailgun signs every POST; the token is single use for longer than
 * this window, so a captured request cannot be replayed inside it either.
 */
export const MAILGUN_SIGNATURE_TOLERANCE_SECONDS = 15 * 60;
const TIMEOUT_MS = 15_000;
/** The fields that change on every POST of one message (never part of a derived Message-ID). */
const SIGNATURE_FIELDS = new Set(['timestamp', 'token', 'signature']);

export type MailgunFetch = (url: string, init: RequestInit) => Promise<Response>;

/** A Mailgun API error (status + a short code; never the key). */
export class MailgunApiError extends Error {
	constructor(
		readonly status: number,
		readonly code: string,
		message: string
	) {
		super(message);
		this.name = 'MailgunApiError';
	}
}

interface MailgunSignature {
	timestamp: string;
	token: string;
	signature: string;
}

const asText = (value: unknown): string =>
	typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';

/**
 * The signature of a Mailgun POST: the `timestamp`, `token` and `signature` form fields of a route, or the `signature`
 * object of a JSON webhook.
 */
function signatureOf(form: InboundForm | null, body: unknown): MailgunSignature | null {
	const fields = form?.fields ?? {};
	const json =
		body && typeof body === 'object' && !Array.isArray(body)
			? (body as Record<string, unknown>)['signature']
			: undefined;
	const nested = json && typeof json === 'object' ? (json as Record<string, unknown>) : {};
	const pick = (name: string) => asText(fields[name]) || asText(nested[name]);
	const signed = { timestamp: pick('timestamp'), token: pick('token'), signature: pick('signature') };
	return signed.timestamp && signed.token && signed.signature ? signed : null;
}

/** `message-headers` (a JSON list of `[name, value]`), lower-cased; the first occurrence wins (Mailgun prepends its own). */
function headersOf(value: string | undefined): Record<string, string> {
	const headers: Record<string, string> = {};
	if (!value) return headers;
	try {
		const list = JSON.parse(value) as unknown;
		for (const entry of Array.isArray(list) ? list : []) {
			if (!Array.isArray(entry) || typeof entry[0] !== 'string' || typeof entry[1] !== 'string') continue;
			const name = entry[0].toLowerCase();
			if (!(name in headers)) headers[name] = entry[1].slice(0, 1000);
		}
	} catch {
		// Not a list: no headers.
	}
	return headers;
}

/**
 * Mailgun (plan 04 §5.2, G-P4-7).
 *
 * - **Inbound.** A Mailgun route `forward()`s each message to the account URL (`/api/inbox/inbound/mailgun/<account
 *   id>`) as a form: the parsed message (fields + `attachment-N` files), or, when the URL ends in `mime`, the raw
 *   message (`body-mime`). Every POST is signed: `signature` = HMAC-SHA256 of `timestamp` + `token` under the account's
 *   **webhook signing key**; a missing or wrong signature, or a timestamp more than 15 minutes away, is refused
 *   (constant-time compare). There is no unsigned mode. The token makes a delivery single use.
 * - **Outbound.** A nodemailer transport over `POST /v3/<domain>/messages` with the API key (US or EU region).
 * - **Test connection.** `GET /v3/domains/<domain>`.
 */
@Injectable()
export class MailgunProvider implements IEmailProviderPlugin, IInboundEmailProvider, OnModuleInit, OnModuleDestroy {
	readonly id = 'mailgun';
	readonly displayName = 'Mailgun';
	readonly description = 'Receive with a Mailgun route and send through the Mailgun Messages API.';
	readonly capabilities = { inbound: true, outbound: true, customDomains: true };
	readonly configSchema = {
		type: 'object' as const,
		properties: {
			webhookSigningKey: {
				type: 'string' as const,
				title: 'Webhook signing key',
				description: 'Mailgun → Sending → Webhooks → HTTP webhook signing key (verifies every inbound POST).',
				writeOnly: true
			},
			apiKey: {
				type: 'string' as const,
				title: 'API key',
				description: 'A Mailgun API key with sending access (sending and the connection test).',
				writeOnly: true
			},
			domain: {
				type: 'string' as const,
				title: 'Sending domain',
				description: 'The Mailgun domain mail is sent from (for example mg.acme.com).',
				format: 'hostname' as const,
				maxLength: 253
			},
			region: {
				type: 'string' as const,
				title: 'Region',
				description: 'Where the Mailgun account lives.',
				enum: ['us', 'eu'],
				default: 'us'
			},
			fromAddress: {
				type: 'string' as const,
				title: 'Default sender',
				description: 'An address on the sending domain.',
				format: 'email' as const
			}
		},
		required: ['webhookSigningKey']
	};
	readonly inbound: IInboundEmailProvider = this;
	private readonly logger = new Logger(MailgunProvider.name);
	/** One parse of a form per request (verify and parse read the same one). */
	private readonly forms = new WeakMap<object, Promise<InboundForm | null>>();

	constructor(
		@Optional() @Inject(INBOX_EMAIL_PROVIDER_REGISTRY) private readonly registry?: IEmailProviderRegistry,
		@Optional() @Inject(MAILGUN_FETCH) private readonly fetcher?: MailgunFetch
	) {}

	onModuleInit(): void {
		if (!this.registry) {
			this.logger.warn(
				'The Inbox email features are off (GAUZY_INBOX_EMAIL_ENABLED): the Mailgun provider stays idle.'
			);
			return;
		}
		this.registry.register(this);
	}

	onModuleDestroy(): void {
		this.registry?.unregister(this.id);
	}

	async verify(request: IInboundWebhookRequest, account: IProviderAccountContext): Promise<IInboundDeliveryIdentity> {
		const key = asText(account.config['webhookSigningKey']);
		const signed = signatureOf(await this.form(request), request.body);
		if (!key || !signed) {
			throw new UnauthorizedException('The Mailgun delivery is not signed for this account.');
		}
		const timestamp = Number(signed.timestamp);
		if (
			!Number.isFinite(timestamp) ||
			Math.abs(Date.now() / 1000 - timestamp) > MAILGUN_SIGNATURE_TOLERANCE_SECONDS
		) {
			throw new UnauthorizedException('The Mailgun signature is too old (or from the future).');
		}
		const expected = createHmac('sha256', key).update(`${signed.timestamp}${signed.token}`, 'utf8').digest();
		const presented = /^[0-9a-f]{64}$/i.test(signed.signature) ? Buffer.from(signed.signature, 'hex') : null;
		if (!presented || !timingSafeEqual(expected, presented)) {
			throw new UnauthorizedException('The Mailgun signature does not verify.');
		}
		// The delivery: Mailgun's token, single use for longer than the window a signature is accepted in.
		return {
			fingerprint: `token:${createHash('sha256').update(signed.token).digest('hex')}`,
			ttlMs: (2 * MAILGUN_SIGNATURE_TOLERANCE_SECONDS + 60) * 1000
		};
	}

	async parse(request: IInboundWebhookRequest): Promise<ParsedInboundEmail[]> {
		const form = await this.form(request);
		if (!form) return [];
		const fields: Record<string, string> = {};
		for (const [name, value] of Object.entries(form.fields)) {
			const key = name.toLowerCase();
			if (!(key in fields)) fields[key] = value;
		}
		const headers = headersOf(fields['message-headers']);
		const field = (name: string) => fields[name] || headers[name] || undefined;

		// Only what Mailgun's servers add is trusted: its SPF and DKIM checks and its spam score. A sender can put any
		// `Authentication-Results` into its message, so no DMARC verdict is taken from it (in a mailbox with an
		// allowlist, an allowlisted sender's Mailgun mail is therefore held in the quarantine for a manager).
		const spf = toVerdict(/^\s*(pass|fail|softfail|neutral|none)/i.exec(headers['x-mailgun-spf'] ?? '')?.[1]);
		const dkim = toVerdict(/^\s*(pass|fail|none)/i.exec(headers['x-mailgun-dkim-check-result'] ?? '')?.[1]);
		const score = Number.parseFloat(headers['x-mailgun-sscore'] ?? '');
		const envelopeRecipients = (fields['recipient'] ?? '')
			.split(',')
			.map((entry) => entry.trim())
			.filter((entry) => entry.includes('@'));
		const envelopeFrom = fields['sender']?.trim();
		const stamp = Number(fields['timestamp']);
		const receivedAt = Number.isFinite(stamp) && stamp > 0 ? new Date(stamp * 1000) : new Date();
		const extra = {
			envelopeRecipients,
			...(envelopeFrom ? { envelopeFrom } : {}),
			receivedAt,
			...(spf ? { spf } : {}),
			...(dkim ? { dkim } : {}),
			...(Number.isFinite(score) ? { spamScore: score } : {})
		};

		const mime = fields['body-mime'] ?? form.files.find((file) => file.field === 'body-mime')?.content;
		if (mime) {
			return [await parseMimeMessage(Buffer.isBuffer(mime) ? mime : Buffer.from(mime, 'utf8'), extra)];
		}

		// `content-id-map`: `{ "<cid>": "attachment-1" }` names the inline parts.
		const inline = new Map<string, string>();
		try {
			const map = JSON.parse(fields['content-id-map'] ?? '{}') as Record<string, unknown>;
			for (const [cid, part] of Object.entries(map ?? {})) {
				if (typeof part === 'string') inline.set(part, cid.replace(/^<|>$/g, ''));
			}
		} catch {
			// No map: no inline parts.
		}
		const attachments: IParsedInboundAttachment[] = form.files
			.filter((file) => /^attachment-\d+$/.test(file.field) && file.content.length > 0)
			.map((file) => {
				const contentId = inline.get(file.field);
				return {
					filename: safeFilename(file.filename),
					...(file.contentType ? { contentType: file.contentType } : {}),
					size: file.content.length,
					content: file.content,
					...(contentId ? { contentId, isInline: true } : { isInline: false })
				};
			});
		const from = parseAddressList(field('from'))[0];
		// Without a Message-ID: one derived from the content (never the signature fields or the multipart boundary,
		// which change on every POST), the same on Mailgun's retry.
		const stable = Object.entries(fields)
			.filter(([name]) => !SIGNATURE_FIELDS.has(name))
			.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
		const messageId =
			messageIdOf(field('message-id')) ??
			derivedMessageId(
				JSON.stringify([
					stable,
					attachments.map((part) => createHash('sha256').update(part.content).digest('hex'))
				])
			);
		const inReplyTo = messageIdOf(field('in-reply-to'));
		const subject = field('subject');
		const text = fields['body-plain'] || undefined;
		const html = fields['body-html'] || undefined;
		return [
			{
				messageId,
				...(from ? { from } : {}),
				to: parseAddressList(field('to')),
				cc: parseAddressList(field('cc')),
				replyTo: parseAddressList(headers['reply-to']),
				...extra,
				...(subject ? { subject } : {}),
				...(text ? { text } : {}),
				...(html ? { html } : {}),
				...(inReplyTo ? { inReplyTo } : {}),
				references: referencesOf(field('references')),
				headers,
				sizeBytes: request.rawBody?.length ?? (text?.length ?? 0) + (html?.length ?? 0),
				attachments
			}
		];
	}

	createTransport(account: IProviderAccountContext): unknown {
		const { key, domain, base } = this.sending(account);
		const from =
			typeof account.config['fromAddress'] === 'string' ? (account.config['fromAddress'] as string) : undefined;
		return providerTransport(
			'mailgun',
			async (mail) => {
				const form = new FormData();
				form.append('from', formatAddress(mail.from));
				for (const entry of mail.to) form.append('to', formatAddress(entry));
				for (const entry of mail.cc) form.append('cc', formatAddress(entry));
				for (const entry of mail.bcc) form.append('bcc', formatAddress(entry));
				if (mail.replyTo.length) form.append('h:Reply-To', mail.replyTo.map(formatAddress).join(', '));
				form.append('subject', mail.subject);
				if (mail.text) form.append('text', mail.text);
				if (mail.html) form.append('html', mail.html);
				for (const [name, value] of Object.entries(mail.headers)) form.append(`h:${name}`, value);
				for (const attachment of mail.attachments) {
					// An inline part goes as `inline`, named by its content id (`cid:` in the HTML).
					form.append(
						attachment.cid ? 'inline' : 'attachment',
						new Blob([new Uint8Array(attachment.content)], {
							type: attachment.contentType ?? 'application/octet-stream'
						}),
						attachment.cid ?? attachment.filename
					);
				}
				const answer = await this.call<{ id?: string; message?: string }>(
					key,
					base,
					'POST',
					`/v3/${encodeURIComponent(domain)}/messages`,
					form
				);
				if (!answer?.id) {
					throw new MailgunApiError(502, 'invalid_response', 'Mailgun accepted the email without an id.');
				}
				return { id: answer.id };
			},
			from
		);
	}

	async verifyAccount(account: IProviderAccountContext): Promise<{ ok: boolean; message?: string }> {
		try {
			const { key, domain, base } = this.sending(account);
			const answer = await this.call<{ domain?: { name?: string; state?: string } }>(
				key,
				base,
				'GET',
				`/v3/domains/${encodeURIComponent(domain)}`
			);
			const state = String(answer?.domain?.state ?? 'unknown').slice(0, 40);
			return {
				ok: state === 'active',
				message:
					state === 'active'
						? `Connected: the Mailgun domain ${domain} is active.`
						: `The Mailgun domain ${domain} is ${state}: finish its DNS setup in Mailgun.`
			};
		} catch (error) {
			if (error instanceof MailgunApiError && (error.status === 401 || error.status === 403))
				return { ok: false, message: 'Mailgun refused the API key.' };
			if (error instanceof MailgunApiError && error.status === 404)
				return { ok: false, message: 'Mailgun has no such domain in this region.' };
			return {
				ok: false,
				message: error instanceof Error ? error.message.slice(0, 300) : 'The connection test failed.'
			};
		}
	}

	private form(request: IInboundWebhookRequest): Promise<InboundForm | null> {
		let form = this.forms.get(request);
		if (!form) {
			form = readInboundForm(request);
			this.forms.set(request, form);
		}
		return form;
	}

	private sending(account: IProviderAccountContext): { key: string; domain: string; base: string } {
		const key = asText(account.config['apiKey']);
		const domain = asText(account.config['domain']).trim().toLowerCase();
		if (!key) throw new MailgunApiError(0, 'missing_key', 'The Mailgun account has no API key.');
		if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain))
			throw new MailgunApiError(0, 'missing_domain', 'The Mailgun account has no sending domain.');
		const base = account.config['region'] === 'eu' ? MAILGUN_API_BASE_URLS.eu : MAILGUN_API_BASE_URLS.us;
		return { key, domain, base };
	}

	private async call<T>(
		key: string,
		base: string,
		method: 'GET' | 'POST',
		path: string,
		body?: FormData
	): Promise<T> {
		const fetcher = this.fetcher ?? ((url: string, init: RequestInit) => fetch(url, init));
		const response = await fetcher(`${base}${path}`, {
			method,
			redirect: 'error',
			signal: AbortSignal.timeout(TIMEOUT_MS),
			headers: {
				Accept: 'application/json',
				Authorization: `Basic ${Buffer.from(`api:${key}`).toString('base64')}`
			},
			...(body ? { body } : {})
		});
		const text = await response.text();
		let data: unknown = null;
		try {
			data = text ? JSON.parse(text) : null;
		} catch {
			data = null;
		}
		if (!response.ok) {
			const message = (data as { message?: unknown } | null)?.message;
			throw new MailgunApiError(
				response.status,
				`http_${response.status}`,
				typeof message === 'string' ? message.slice(0, 300) : `Mailgun answered ${response.status}.`
			);
		}
		return data as T;
	}
}
