import { Inject, Injectable, OnModuleDestroy, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { verifyWebhookSignature, WEBHOOK_SIGNATURE_TOLERANCE_SECONDS } from '@gauzy/core';
import { InboundReplayGuard } from '../../inbound/replay-guard.service';
import {
	derivedMessageId,
	messageIdOf,
	parseMimeMessage,
	referencesOf,
	safeFilename,
	toVerdict,
	verdictsFromAuthenticationResults
} from '../../inbound/mime';
import { GENERIC_PROVIDER_ID } from '../../inbox-email.constants';
import { EmailProviderRegistry } from '../email-provider.registry';
import {
	IEmailProviderPlugin,
	IInboundEmailAddress,
	IInboundEmailProvider,
	IInboundWebhookRequest,
	IParsedInboundAttachment,
	IProviderAccountContext,
	ParsedInboundEmail
} from '../email-provider.types';

/** The signature header of the generic webhook: `t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">`. */
export const GENERIC_SIGNATURE_HEADER = 'x-gauzy-inbox-signature';

/** The most messages one generic delivery may carry. */
export const GENERIC_MAX_MESSAGES = 20;

type Body = Record<string, unknown>;

const isObject = (value: unknown): value is Body => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() ? value : undefined);

/** An address given as `"a@b"`, `"Name <a@b>"` or `{ address, name }`. */
function address(value: unknown): IInboundEmailAddress | undefined {
	if (isObject(value)) {
		const addr = text(value['address']) ?? text(value['email']);
		if (!addr) return undefined;
		const name = text(value['name']);
		return name ? { address: addr.trim(), name } : { address: addr.trim() };
	}
	const raw = text(value);
	if (!raw) return undefined;
	const match = /^\s*"?([^"<]*?)"?\s*<([^<>]+)>\s*$/.exec(raw);
	if (match) {
		const name = (match[1] as string).trim();
		return name ? { address: (match[2] as string).trim(), name } : { address: (match[2] as string).trim() };
	}
	return { address: raw.trim() };
}

function addresses(value: unknown): IInboundEmailAddress[] {
	const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : value ? [value] : [];
	return list.map(address).filter((entry): entry is IInboundEmailAddress => !!entry);
}

function strings(value: unknown): string[] {
	const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
	return list.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean);
}

/**
 * The built-in generic signed webhook (plan 04 §5.2): the format the Cloudflare Email Worker (the platform default
 * on `GAUZY_INBOX_DOMAIN`) posts to `/api/inbox/inbound/generic/platform`, and that any relay can post to a generic
 * provider account.
 *
 * **Verification.** `X-Gauzy-Inbox-Signature: t=<unix seconds>,v1=<hex>` — HMAC-SHA256 over `<t>.<raw body>`
 * keyed with the account's signing secret (the platform route: `GAUZY_INBOX_PLATFORM_SECRET`), 5-minute window,
 * constant-time compare, single use (Redis `SET NX` when available). No raw body, no secret, a stale or reused
 * signature: refused. There is no unsigned mode.
 *
 * **Body** (JSON): `{ "messages": [ … ] }` or one message. A message is either raw MIME —
 * `{ "raw": "<base64 RFC 5322>", "envelope": { "from": "…", "to": ["…"] }, "authenticationResults": "…",
 * "spamScore": 1.2 }` — or structured: `{ "from", "to", "cc", "replyTo", "subject", "text", "html", "messageId",
 * "inReplyTo", "references", "headers", "attachments": [{ "filename", "contentType", "content": "<base64>",
 * "contentId", "inline" }], "envelope", "spf", "dkim", "dmarc", "spamScore" }`.
 */
@Injectable()
export class GenericWebhookProvider implements IEmailProviderPlugin, IInboundEmailProvider, OnModuleInit, OnModuleDestroy {
	readonly id = GENERIC_PROVIDER_ID;
	readonly displayName = 'Generic signed webhook';
	readonly description =
		'Any relay that signs its POSTs with the account’s signing secret (HMAC-SHA256 over "<timestamp>.<body>").';
	readonly capabilities = { inbound: true, outbound: false, customDomains: true };
	readonly configSchema = {
		type: 'object' as const,
		properties: {
			signingSecret: {
				type: 'string' as const,
				title: 'Signing secret',
				description: 'Generated when left empty; the relay signs every POST with it.',
				generated: true,
				minLength: 24
			}
		},
		required: ['signingSecret']
	};
	readonly inbound: IInboundEmailProvider = this;

	constructor(
		private readonly registry: EmailProviderRegistry,
		@Inject(InboundReplayGuard) private readonly replay: InboundReplayGuard
	) {}

	onModuleInit(): void {
		this.registry.register(this);
	}

	onModuleDestroy(): void {
		this.registry.unregister(this.id);
	}

	async verify(request: IInboundWebhookRequest, account: IProviderAccountContext): Promise<void> {
		const secret = typeof account.config['signingSecret'] === 'string' ? (account.config['signingSecret'] as string) : '';
		const raw = request.headers[GENERIC_SIGNATURE_HEADER];
		const header = Array.isArray(raw) ? raw[0] : raw;
		if (!secret || !header || !request.rawBody?.length) {
			throw new UnauthorizedException('The delivery is not signed.');
		}
		let valid = false;
		try {
			valid = verifyWebhookSignature(secret, request.rawBody.toString('utf8'), header);
		} catch {
			valid = false;
		}
		if (!valid) {
			throw new UnauthorizedException('The delivery signature does not verify.');
		}
		const fresh = await this.replay.consume(
			`${this.id}:${account.id ?? 'platform'}`,
			header.replace(/\s+/g, ''),
			(2 * WEBHOOK_SIGNATURE_TOLERANCE_SECONDS + 60) * 1000
		);
		if (!fresh) {
			throw new UnauthorizedException('The delivery was already received.');
		}
	}

	async parse(request: IInboundWebhookRequest): Promise<ParsedInboundEmail[]> {
		const body = isObject(request.body) ? request.body : {};
		const list = Array.isArray(body['messages']) ? (body['messages'] as unknown[]) : [body];
		const messages: ParsedInboundEmail[] = [];
		for (const entry of list.slice(0, GENERIC_MAX_MESSAGES)) {
			if (isObject(entry)) messages.push(await this.parseOne(entry));
		}
		return messages;
	}

	private async parseOne(entry: Body): Promise<ParsedInboundEmail> {
		const envelope = isObject(entry['envelope']) ? entry['envelope'] : {};
		const envelopeRecipients = strings(envelope['to']);
		const envelopeFrom = text(envelope['from']);
		const fromResults = verdictsFromAuthenticationResults(entry['authenticationResults']);
		const verdicts = {
			spf: toVerdict(entry['spf']) ?? fromResults.spf,
			dkim: toVerdict(entry['dkim']) ?? fromResults.dkim,
			dmarc: toVerdict(entry['dmarc']) ?? fromResults.dmarc
		};
		const spamScore = typeof entry['spamScore'] === 'number' && Number.isFinite(entry['spamScore']) ? entry['spamScore'] : undefined;
		const receivedAt = text(entry['receivedAt']) ? new Date(entry['receivedAt'] as string) : new Date();
		const when = Number.isNaN(receivedAt.getTime()) ? new Date() : receivedAt;

		const raw = text(entry['raw']);
		if (raw) {
			return parseMimeMessage(Buffer.from(raw, 'base64'), {
				envelopeRecipients,
				...(envelopeFrom ? { envelopeFrom } : {}),
				receivedAt: when,
				...(verdicts.spf ? { spf: verdicts.spf } : {}),
				...(verdicts.dkim ? { dkim: verdicts.dkim } : {}),
				...(verdicts.dmarc ? { dmarc: verdicts.dmarc } : {}),
				...(spamScore !== undefined ? { spamScore } : {})
			});
		}

		const attachments: IParsedInboundAttachment[] = (Array.isArray(entry['attachments']) ? entry['attachments'] : [])
			.filter(isObject)
			.map((attachment) => {
				const content = Buffer.from(text(attachment['content']) ?? '', 'base64');
				const contentId = text(attachment['contentId']);
				const contentType = text(attachment['contentType']);
				return {
					filename: safeFilename(attachment['filename']),
					...(contentType ? { contentType } : {}),
					size: content.length,
					content,
					...(contentId ? { contentId: contentId.replace(/^<|>$/g, '') } : {}),
					isInline: attachment['inline'] === true
				};
			})
			.filter((attachment) => attachment.size > 0);
		const headers: Record<string, string> = {};
		if (isObject(entry['headers'])) {
			for (const [name, value] of Object.entries(entry['headers'])) {
				if (typeof value === 'string') headers[name.toLowerCase()] = value.slice(0, 1000);
			}
		}
		const from = address(entry['from']);
		const subject = text(entry['subject']);
		const textBody = text(entry['text']);
		const html = text(entry['html']);
		const inReplyTo = messageIdOf(entry['inReplyTo']);
		const sizeBytes =
			(textBody?.length ?? 0) + (html?.length ?? 0) + attachments.reduce((sum, attachment) => sum + attachment.size, 0);
		return {
			messageId:
				messageIdOf(entry['messageId']) ??
				derivedMessageId(JSON.stringify([from?.address, subject, textBody, html, envelopeRecipients, entry['receivedAt']])),
			...(from ? { from } : {}),
			to: addresses(entry['to']),
			cc: addresses(entry['cc']),
			replyTo: addresses(entry['replyTo']),
			envelopeRecipients,
			...(envelopeFrom ? { envelopeFrom } : {}),
			...(subject ? { subject } : {}),
			...(textBody ? { text: textBody } : {}),
			...(html ? { html } : {}),
			...(inReplyTo ? { inReplyTo } : {}),
			references: referencesOf(entry['references']),
			headers,
			receivedAt: when,
			sizeBytes,
			...(verdicts.spf ? { spf: verdicts.spf } : {}),
			...(verdicts.dkim ? { dkim: verdicts.dkim } : {}),
			...(verdicts.dmarc ? { dmarc: verdicts.dmarc } : {}),
			...(spamScore !== undefined ? { spamScore } : {}),
			attachments
		};
	}
}
