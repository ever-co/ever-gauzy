// cspell:ignore softfail dmarc temperror permerror
import {
	Inject,
	Injectable,
	Logger,
	OnModuleDestroy,
	OnModuleInit,
	Optional,
	UnauthorizedException
} from '@nestjs/common';
import { createHash, createPublicKey, createVerify, KeyObject } from 'node:crypto';
import { INBOX_EMAIL_PROVIDER_REGISTRY } from '@gauzy/contracts';
import {
	derivedMessageId,
	headerValue,
	IEmailProviderPlugin,
	IEmailProviderRegistry,
	IInboundDeliveryIdentity,
	IInboundEmailProvider,
	IInboundWebhookRequest,
	IParsedInboundAttachment,
	IProviderAccountContext,
	InboundForm,
	messageIdOf,
	OutboundAddress,
	parseAddressList,
	parseMimeMessage,
	ParsedInboundEmail,
	providerTransport,
	readInboundForm,
	referencesOf,
	safeFilename,
	toVerdict
} from '@gauzy/plugin-inbox';

/** The Mail Send API of each region (https, no redirects). */
export const SENDGRID_API_BASE_URLS = { us: 'https://api.sendgrid.com', eu: 'https://api.eu.sendgrid.com' } as const;
/** The token a spec replaces `fetch` with. */
export const SENDGRID_FETCH = 'SENDGRID_FETCH';
/** The headers of a signed Inbound Parse POST (the scheme of SendGrid's signed webhooks). */
export const SENDGRID_SIGNATURE_HEADER = 'x-twilio-email-event-webhook-signature';
export const SENDGRID_TIMESTAMP_HEADER = 'x-twilio-email-event-webhook-timestamp';
/** How far a signature's timestamp may be from now; the signature is single use for longer than this. */
export const SENDGRID_SIGNATURE_TOLERANCE_SECONDS = 15 * 60;
const TIMEOUT_MS = 15_000;

export type SendGridFetch = (url: string, init: RequestInit) => Promise<Response>;

/** A SendGrid API error (status + a short code; never the key). */
export class SendGridApiError extends Error {
	constructor(
		readonly status: number,
		readonly code: string,
		message: string
	) {
		super(message);
		this.name = 'SendGridApiError';
	}
}

const asText = (value: unknown): string => (typeof value === 'string' ? value : '');

/** The account's verification key: SendGrid's public key, as base64 (DER, SPKI) or PEM; `null` when it is no EC key. */
export function verificationKeyOf(value: unknown): KeyObject | null {
	const text = asText(value).trim();
	if (!text) return null;
	try {
		const key = text.includes('BEGIN PUBLIC KEY')
			? createPublicKey(text)
			: createPublicKey({ key: Buffer.from(text.replace(/\s+/g, ''), 'base64'), format: 'der', type: 'spki' });
		return key.asymmetricKeyType === 'ec' ? key : null;
	} catch {
		return null;
	}
}

/** A raw header block (`Name: value` lines, folded lines continued), lower-cased; the first occurrence wins. */
function headersOf(block: string | undefined): Record<string, string> {
	const headers: Record<string, string> = {};
	if (!block) return headers;
	const lines: string[] = [];
	for (const line of block.split(/\r?\n/)) {
		if (/^[ \t]/.test(line) && lines.length > 0) lines[lines.length - 1] += ` ${line.trim()}`;
		else if (line.trim()) lines.push(line);
	}
	for (const line of lines) {
		const colon = line.indexOf(':');
		if (colon <= 0) continue;
		const name = line.slice(0, colon).trim().toLowerCase();
		if (name && !(name in headers))
			headers[name] = line
				.slice(colon + 1)
				.trim()
				.slice(0, 1000);
	}
	return headers;
}

/** SendGrid's `dkim` field (`{@acme.test : pass, @other.test : fail}`): pass when one signature passed. */
function dkimOf(value: string | undefined) {
	const verdicts = [...(value ?? '').matchAll(/:\s*([a-z]+)/gi)].map((match) => toVerdict(match[1]));
	if (verdicts.includes('pass')) return 'pass' as const;
	return verdicts.find((verdict) => !!verdict);
}

const json = <T>(value: string | undefined, fallback: T): T => {
	try {
		return value ? ((JSON.parse(value) as T) ?? fallback) : fallback;
	} catch {
		return fallback;
	}
};

const person = (entry: OutboundAddress) =>
	entry.name ? { email: entry.address, name: entry.name } : { email: entry.address };

/**
 * SendGrid (plan 04 §5.2, G-P4-7).
 *
 * - **Inbound.** Inbound Parse POSTs each message to the account URL (`/api/inbox/inbound/sendgrid/<account id>`) as a
 *   multipart form: the parsed message (`headers`, `text`, `html`, `attachmentN` files, `envelope`, `SPF`, `dkim`,
 *   `spam_score`), or with "POST the raw, full MIME message" the raw message (`email`). The parse setting's security
 *   policy signs every POST: an ECDSA (P-256, SHA-256) signature over `<timestamp><raw body>` in
 *   `X-Twilio-Email-Event-Webhook-Signature`, the timestamp in `…-Timestamp`, checked against the account's
 *   **verification key** (SendGrid's public key). A missing or wrong signature, or a timestamp more than 15 minutes
 *   away, is refused. There is no unsigned mode. The signature makes a delivery single use.
 * - **Outbound.** A nodemailer transport over `POST /v3/mail/send` with the API key (global or EU region).
 * - **Test connection.** `GET /v3/scopes`: the key must be able to send (`mail.send`).
 */
@Injectable()
export class SendGridProvider implements IEmailProviderPlugin, IInboundEmailProvider, OnModuleInit, OnModuleDestroy {
	readonly id = 'sendgrid';
	readonly displayName = 'SendGrid';
	readonly description = 'Receive with SendGrid Inbound Parse and send through the SendGrid Mail Send API.';
	readonly capabilities = { inbound: true, outbound: true, customDomains: true };
	readonly configSchema = {
		type: 'object' as const,
		properties: {
			verificationKey: {
				type: 'string' as const,
				title: 'Verification key',
				description:
					'SendGrid’s public key of the Inbound Parse security policy (base64 or PEM): every inbound POST is checked against it.',
				format: 'textarea' as const,
				maxLength: 2000
			},
			apiKey: {
				type: 'string' as const,
				title: 'API key',
				description: 'A SendGrid API key with the Mail Send permission (sending and the connection test).',
				writeOnly: true
			},
			region: {
				type: 'string' as const,
				title: 'Region',
				description: 'Global, or EU for an EU-pinned subuser.',
				enum: ['us', 'eu'],
				default: 'us'
			},
			fromAddress: {
				type: 'string' as const,
				title: 'Default sender',
				description: 'A verified sender or an address on an authenticated domain.',
				format: 'email' as const
			}
		},
		required: ['verificationKey']
	};
	readonly inbound: IInboundEmailProvider = this;
	private readonly logger = new Logger(SendGridProvider.name);
	/** One parse of a form per request. */
	private readonly forms = new WeakMap<object, Promise<InboundForm | null>>();

	constructor(
		@Optional() @Inject(INBOX_EMAIL_PROVIDER_REGISTRY) private readonly registry?: IEmailProviderRegistry,
		@Optional() @Inject(SENDGRID_FETCH) private readonly fetcher?: SendGridFetch
	) {}

	onModuleInit(): void {
		if (!this.registry) {
			this.logger.warn(
				'The Inbox email features are off (GAUZY_INBOX_EMAIL_ENABLED): the SendGrid provider stays idle.'
			);
			return;
		}
		this.registry.register(this);
	}

	onModuleDestroy(): void {
		this.registry?.unregister(this.id);
	}

	async verify(request: IInboundWebhookRequest, account: IProviderAccountContext): Promise<IInboundDeliveryIdentity> {
		const key = verificationKeyOf(account.config['verificationKey']);
		const signature = headerValue(request, SENDGRID_SIGNATURE_HEADER).trim();
		const timestamp = headerValue(request, SENDGRID_TIMESTAMP_HEADER).trim();
		if (!key || !signature || !/^\d{1,12}$/.test(timestamp) || !request.rawBody?.length) {
			throw new UnauthorizedException('The SendGrid delivery is not signed for this account.');
		}
		if (Math.abs(Date.now() / 1000 - Number(timestamp)) > SENDGRID_SIGNATURE_TOLERANCE_SECONDS) {
			throw new UnauthorizedException('The SendGrid signature is too old (or from the future).');
		}
		let valid = false;
		try {
			const verifier = createVerify('sha256');
			verifier.update(timestamp, 'utf8');
			verifier.update(request.rawBody);
			verifier.end();
			valid = verifier.verify(key, Buffer.from(signature, 'base64'));
		} catch {
			valid = false;
		}
		if (!valid) throw new UnauthorizedException('The SendGrid signature does not verify.');
		return {
			fingerprint: `sig:${createHash('sha256').update(signature).digest('hex')}`,
			ttlMs: (2 * SENDGRID_SIGNATURE_TOLERANCE_SECONDS + 60) * 1000
		};
	}

	async parse(request: IInboundWebhookRequest): Promise<ParsedInboundEmail[]> {
		const form = await this.form(request);
		if (!form) return [];
		const fields = form.fields;
		const envelope = json<{ to?: unknown; from?: unknown }>(fields['envelope'], {});
		const envelopeRecipients = (Array.isArray(envelope.to) ? envelope.to : [])
			.filter((entry): entry is string => typeof entry === 'string' && entry.includes('@'))
			.map((entry) => entry.trim());
		const envelopeFrom = typeof envelope.from === 'string' ? envelope.from.trim() : '';
		// SendGrid's own checks (fields it adds, not headers of the message): SPF, DKIM, the SpamAssassin score. No
		// DMARC verdict is reported, so in a mailbox with an allowlist an allowlisted sender's mail is held in the
		// quarantine for a manager.
		const spf = toVerdict(fields['SPF'] ?? fields['spf']);
		const dkim = dkimOf(fields['dkim']);
		const score = Number.parseFloat(fields['spam_score'] ?? '');
		const extra = {
			envelopeRecipients,
			...(envelopeFrom ? { envelopeFrom } : {}),
			receivedAt: new Date(),
			...(spf ? { spf } : {}),
			...(dkim ? { dkim } : {}),
			...(Number.isFinite(score) ? { spamScore: score } : {})
		};

		const raw = fields['email'] ?? form.files.find((file) => file.field === 'email')?.content;
		if (raw) {
			return [await parseMimeMessage(Buffer.isBuffer(raw) ? raw : Buffer.from(raw, 'utf8'), extra)];
		}

		const headers = headersOf(fields['headers']);
		const info = json<
			Record<string, { filename?: unknown; name?: unknown; type?: unknown; 'content-id'?: unknown }>
		>(fields['attachment-info'], {});
		const inline = new Map<string, string>();
		for (const [cid, part] of Object.entries(json<Record<string, unknown>>(fields['content-ids'], {}))) {
			if (typeof part === 'string') inline.set(part, cid.replace(/^<|>$/g, ''));
		}
		const attachments: IParsedInboundAttachment[] = form.files
			.filter((file) => /^attachment\d+$/.test(file.field) && file.content.length > 0)
			.map((file) => {
				const described = info[file.field] ?? {};
				const contentId =
					inline.get(file.field) ??
					(typeof described['content-id'] === 'string' ? described['content-id'] : undefined);
				const type = typeof described.type === 'string' ? described.type : file.contentType;
				return {
					filename: safeFilename(typeof described.filename === 'string' ? described.filename : file.filename),
					...(type ? { contentType: type } : {}),
					size: file.content.length,
					content: file.content,
					...(contentId ? { contentId, isInline: true } : { isInline: false })
				};
			});
		const from = parseAddressList(fields['from'] ?? headers['from'])[0];
		const messageId =
			messageIdOf(headers['message-id']) ??
			// Without a Message-ID: one derived from the message (the same on SendGrid's retry).
			derivedMessageId(
				JSON.stringify([
					fields['headers'] ?? '',
					fields['text'] ?? '',
					fields['html'] ?? '',
					attachments.map((part) => createHash('sha256').update(part.content).digest('hex'))
				])
			);
		const inReplyTo = messageIdOf(headers['in-reply-to']);
		const subject = fields['subject'] ?? headers['subject'];
		const text = fields['text'] || undefined;
		const html = fields['html'] || undefined;
		const sent = headers['date'] ? new Date(headers['date']) : null;
		return [
			{
				messageId,
				...(from ? { from } : {}),
				to: parseAddressList(fields['to'] ?? headers['to']),
				cc: parseAddressList(fields['cc'] ?? headers['cc']),
				replyTo: parseAddressList(headers['reply-to']),
				...extra,
				...(sent && !Number.isNaN(sent.getTime()) ? { sentAt: sent } : {}),
				...(subject ? { subject } : {}),
				...(text ? { text } : {}),
				...(html ? { html } : {}),
				...(inReplyTo ? { inReplyTo } : {}),
				references: referencesOf(headers['references']),
				headers,
				// The message's own bytes (never the form around them).
				sizeBytes:
					Buffer.byteLength(text ?? '') +
					Buffer.byteLength(html ?? '') +
					Buffer.byteLength(fields['headers'] ?? '') +
					attachments.reduce((sum, part) => sum + part.size, 0),
				attachments
			}
		];
	}

	createTransport(account: IProviderAccountContext): unknown {
		const { key, base } = this.sending(account);
		const from =
			typeof account.config['fromAddress'] === 'string' ? (account.config['fromAddress'] as string) : undefined;
		return providerTransport(
			'sendgrid',
			async (mail) => {
				// text/plain first (SendGrid requires that order); at least one part.
				const content = [
					...(mail.text ? [{ type: 'text/plain', value: mail.text }] : []),
					...(mail.html ? [{ type: 'text/html', value: mail.html }] : [])
				];
				const response = await this.call(key, base, 'POST', '/v3/mail/send', {
					personalizations: [
						{
							to: mail.to.map(person),
							...(mail.cc.length ? { cc: mail.cc.map(person) } : {}),
							...(mail.bcc.length ? { bcc: mail.bcc.map(person) } : {})
						}
					],
					from: person(mail.from),
					...(mail.replyTo.length === 1 ? { reply_to: person(mail.replyTo[0] as OutboundAddress) } : {}),
					...(mail.replyTo.length > 1 ? { reply_to_list: mail.replyTo.map(person) } : {}),
					subject: mail.subject,
					content: content.length ? content : [{ type: 'text/plain', value: ' ' }],
					headers: mail.headers,
					...(mail.attachments.length
						? {
								attachments: mail.attachments.map((attachment) => ({
									content: attachment.content.toString('base64'),
									filename: attachment.filename,
									type: attachment.contentType ?? 'application/octet-stream',
									disposition: attachment.cid ? 'inline' : 'attachment',
									...(attachment.cid ? { content_id: attachment.cid } : {})
								}))
							}
						: {})
				});
				// 202 with no body; the message id is a response header.
				const id = response.headers.get('x-message-id');
				if (!id)
					throw new SendGridApiError(502, 'invalid_response', 'SendGrid accepted the email without an id.');
				return { id };
			},
			from
		);
	}

	async verifyAccount(account: IProviderAccountContext): Promise<{ ok: boolean; message?: string }> {
		try {
			const { key, base } = this.sending(account);
			const response = await this.call(key, base, 'GET', '/v3/scopes');
			const scopes = (((await response.json().catch(() => null)) as { scopes?: unknown } | null)?.scopes ??
				[]) as unknown[];
			const sends = scopes.includes('mail.send');
			return {
				ok: sends,
				message: sends
					? 'Connected: the SendGrid key can send mail.'
					: 'The SendGrid key cannot send mail (it lacks the Mail Send permission).'
			};
		} catch (error) {
			if (error instanceof SendGridApiError && (error.status === 401 || error.status === 403))
				return { ok: false, message: 'SendGrid refused the API key.' };
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

	private sending(account: IProviderAccountContext): { key: string; base: string } {
		const key = asText(account.config['apiKey']);
		if (!key) throw new SendGridApiError(0, 'missing_key', 'The SendGrid account has no API key.');
		const base = account.config['region'] === 'eu' ? SENDGRID_API_BASE_URLS.eu : SENDGRID_API_BASE_URLS.us;
		return { key, base };
	}

	/** Calls the API and answers the response (its body unread); a non-2xx answer is a {@link SendGridApiError}. */
	private async call(
		key: string,
		base: string,
		method: 'GET' | 'POST',
		path: string,
		body?: unknown
	): Promise<Response> {
		const fetcher = this.fetcher ?? ((url: string, init: RequestInit) => fetch(url, init));
		const response = await fetcher(`${base}${path}`, {
			method,
			redirect: 'error',
			signal: AbortSignal.timeout(TIMEOUT_MS),
			headers: {
				Accept: 'application/json',
				Authorization: `Bearer ${key}`,
				...(body !== undefined ? { 'Content-Type': 'application/json' } : {})
			},
			...(body !== undefined ? { body: JSON.stringify(body) } : {})
		});
		if (!response.ok) {
			const text = await response.text().catch(() => '');
			let message = `SendGrid answered ${response.status}.`;
			try {
				const first = (JSON.parse(text) as { errors?: Array<{ message?: unknown }> })?.errors?.[0]?.message;
				if (typeof first === 'string') message = first.slice(0, 300);
			} catch {
				// Not JSON: the status says enough.
			}
			throw new SendGridApiError(response.status, `http_${response.status}`, message);
		}
		return response;
	}
}
