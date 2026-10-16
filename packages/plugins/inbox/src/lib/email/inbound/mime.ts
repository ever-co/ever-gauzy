// cspell:ignore dmarc softfail temperror permerror mailparser
import { createHash } from 'node:crypto';
import { MailparserAddress, MailparserAddressObject, simpleParser } from 'mailparser';
import {
	IInboundEmailAddress,
	InboundAuthVerdict,
	IParsedInboundAttachment,
	ParsedInboundEmail
} from '../providers/email-provider.types';

/** The headers a stored message keeps (lower-case names). Everything else stays in the raw message only. */
export const ALLOWLISTED_HEADERS = new Set([
	'date',
	'message-id',
	'in-reply-to',
	'references',
	'subject',
	'from',
	'to',
	'cc',
	'reply-to',
	'sender',
	'delivered-to',
	'x-original-to',
	'list-id',
	'list-unsubscribe',
	'auto-submitted',
	'precedence',
	'x-auto-response-suppress',
	'content-language',
	'x-mailer',
	'user-agent',
	'authentication-results',
	'received-spf',
	'x-spam-score',
	'x-spam-status'
]);

const MAX_HEADER_VALUE = 1000;
const VERDICTS: readonly InboundAuthVerdict[] = [
	'pass',
	'fail',
	'softfail',
	'neutral',
	'none',
	'temperror',
	'permerror'
];

/** A verdict word, or `undefined`. */
export function toVerdict(value: unknown): InboundAuthVerdict | undefined {
	if (typeof value === 'boolean') return value ? 'pass' : 'fail';
	if (typeof value !== 'string') return undefined;
	const word = value.trim().toLowerCase() as InboundAuthVerdict;
	return VERDICTS.includes(word) ? word : undefined;
}

/**
 * The SPF / DKIM / DMARC verdicts of an `Authentication-Results` header (RFC 8601), e.g.
 * `mx.example; spf=pass smtp.mailfrom=…; dkim=pass header.d=…; dmarc=pass header.from=…`.
 *
 * Only call it with a header the receiving side added (the topmost one, from a provider the account trusts): a sender
 * can put any `Authentication-Results` into the message it sends.
 */
export function verdictsFromAuthenticationResults(header: unknown): {
	spf?: InboundAuthVerdict;
	dkim?: InboundAuthVerdict;
	dmarc?: InboundAuthVerdict;
} {
	if (typeof header !== 'string') return {};
	const out: { spf?: InboundAuthVerdict; dkim?: InboundAuthVerdict; dmarc?: InboundAuthVerdict } = {};
	for (const method of ['spf', 'dkim', 'dmarc'] as const) {
		const match = new RegExp(`(?:^|[;\\s])${method}\\s*=\\s*([a-z]+)`, 'i').exec(header);
		const verdict = toVerdict(match?.[1]);
		if (verdict) out[method] = verdict;
	}
	return out;
}

/** The addresses of a parsed address header (groups flattened). */
export function addressesOf(
	value: MailparserAddressObject | MailparserAddressObject[] | undefined
): IInboundEmailAddress[] {
	const objects = value === undefined ? [] : Array.isArray(value) ? value : [value];
	const out: IInboundEmailAddress[] = [];
	const visit = (entry: MailparserAddress) => {
		if (Array.isArray(entry.group)) {
			entry.group.forEach(visit);
			return;
		}
		if (typeof entry.address === 'string' && entry.address.includes('@')) {
			out.push(entry.name ? { address: entry.address, name: entry.name } : { address: entry.address });
		}
	};
	for (const object of objects) (object?.value ?? []).forEach(visit);
	return out;
}

/** The allowlisted headers of a message, from its raw header lines (unfolded, bounded; the first of a repeated one). */
export function allowlistedHeaders(lines: Array<{ key: string; line: string }> | undefined): Record<string, string> {
	const headers: Record<string, string> = {};
	for (const { key, line } of lines ?? []) {
		const name = String(key).toLowerCase();
		if (!ALLOWLISTED_HEADERS.has(name) || name in headers) continue;
		const colon = line.indexOf(':');
		const value = (colon >= 0 ? line.slice(colon + 1) : '').replace(/\r?\n[ \t]+/g, ' ').trim();
		headers[name] = value.slice(0, MAX_HEADER_VALUE);
	}
	return headers;
}

/** `<id@host>` (the form message ids are stored and compared in), or `undefined`. */
export function messageIdOf(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined;
	const text = value.trim();
	if (!text) return undefined;
	const bracketed = text.startsWith('<') ? text : `<${text}>`;
	return bracketed.endsWith('>') ? bracketed.slice(0, 512) : `${bracketed}>`.slice(0, 512);
}

/** The message ids of a `References` value (a string of ids, or a list). */
export function referencesOf(value: unknown): string[] {
	const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/\s+/) : [];
	return raw
		.map(messageIdOf)
		.filter((id): id is string => !!id)
		.slice(-50);
}

/** A message id derived from the content, for a message that carries none (so a retry still deduplicates). */
export function derivedMessageId(content: Buffer | string): string {
	return `<${createHash('sha256').update(content).digest('hex').slice(0, 40)}@inbox.gauzy.invalid>`;
}

/**
 * Parses a raw MIME message (RFC 5322) into the normalized message. `cid:` links stay in the HTML (the inline parts are
 * attachments with a `contentId`); the HTML is NOT sanitized here — the worker does that before anything is stored.
 *
 * @param raw The message bytes.
 * @param extra What the provider knows beyond the message: the envelope, the verdicts, the score, the time.
 */
export async function parseMimeMessage(
	raw: Buffer,
	extra: Partial<
		Pick<
			ParsedInboundEmail,
			| 'envelopeRecipients'
			| 'envelopeFrom'
			| 'receivedAt'
			| 'spf'
			| 'dkim'
			| 'dmarc'
			| 'spamScore'
			| 'providerMessageId'
		>
	> = {}
): Promise<ParsedInboundEmail> {
	const mail = await simpleParser(raw, {
		keepCidLinks: true,
		skipHtmlToText: true,
		skipTextToHtml: true,
		skipTextLinks: true,
		skipImageLinks: true
	});
	const attachments: IParsedInboundAttachment[] = (mail.attachments ?? []).map((part) => ({
		filename: safeFilename(part.filename),
		...(part.contentType ? { contentType: part.contentType } : {}),
		size: part.content?.length ?? 0,
		content: part.content ?? Buffer.alloc(0),
		...(part.cid ? { contentId: part.cid } : {}),
		isInline: part.contentDisposition === 'inline' || (!!part.cid && !!part.related)
	}));
	const from = addressesOf(mail.from)[0];
	const replyTo = addressesOf(mail.replyTo);
	const message: ParsedInboundEmail = {
		messageId: messageIdOf(mail.messageId) ?? derivedMessageId(raw),
		...(extra.providerMessageId ? { providerMessageId: extra.providerMessageId } : {}),
		...(from ? { from } : {}),
		to: addressesOf(mail.to),
		cc: addressesOf(mail.cc),
		replyTo,
		envelopeRecipients: (extra.envelopeRecipients ?? []).filter((value) => typeof value === 'string'),
		...(extra.envelopeFrom ? { envelopeFrom: extra.envelopeFrom } : {}),
		...(typeof mail.subject === 'string' ? { subject: mail.subject } : {}),
		...(typeof mail.text === 'string' ? { text: mail.text } : {}),
		...(typeof mail.html === 'string' ? { html: mail.html } : {}),
		...(messageIdOf(mail.inReplyTo) ? { inReplyTo: messageIdOf(mail.inReplyTo) } : {}),
		references: referencesOf(mail.references),
		headers: allowlistedHeaders(mail.headerLines),
		...(mail.date instanceof Date && !Number.isNaN(mail.date.getTime()) ? { sentAt: mail.date } : {}),
		receivedAt: extra.receivedAt ?? new Date(),
		sizeBytes: raw.length,
		...(extra.spf ? { spf: extra.spf } : {}),
		...(extra.dkim ? { dkim: extra.dkim } : {}),
		...(extra.dmarc ? { dmarc: extra.dmarc } : {}),
		...(typeof extra.spamScore === 'number' ? { spamScore: extra.spamScore } : {}),
		attachments,
		raw
	};
	return message;
}

/** An attachment name safe to store and to offer for download (no path, no control characters, ≤ 255). */
export function safeFilename(name: unknown): string {
	const text = typeof name === 'string' ? name : '';
	const base = text
		.replace(/^.*[\\/]/, '')
		.replace(/[\u0000-\u001f\u007f"<>|:*?]/g, '_')
		.trim();
	return (base || 'attachment').slice(0, 255);
}

/**
 * A message as stored when the provider delivered no MIME (the `.json` raw form): the parsed fields with attachment
 * bytes as base64. {@link deserializeParsedMessage} reads it back.
 */
export function serializeParsedMessage(message: ParsedInboundEmail): Buffer {
	const { raw: _raw, attachments, ...rest } = message;
	return Buffer.from(
		JSON.stringify({
			format: 'gauzy-inbox-message/1',
			...rest,
			attachments: attachments.map(({ content, ...attachment }) => ({
				...attachment,
				content: content.toString('base64')
			}))
		}),
		'utf8'
	);
}

/** Reads a `.json` raw form back into the normalized message. Throws on anything else. */
export function deserializeParsedMessage(buffer: Buffer): ParsedInboundEmail {
	const data = JSON.parse(buffer.toString('utf8')) as Record<string, unknown>;
	if (data['format'] !== 'gauzy-inbox-message/1') {
		throw new Error('The stored message is not in a format this version reads.');
	}
	const date = (value: unknown) => (typeof value === 'string' || value instanceof Date ? new Date(value) : undefined);
	const attachments = Array.isArray(data['attachments'])
		? (data['attachments'] as Array<Record<string, unknown>>)
		: [];
	const sentAt = date(data['sentAt']);
	return {
		...(data as unknown as ParsedInboundEmail),
		receivedAt: date(data['receivedAt']) ?? new Date(),
		...(sentAt ? { sentAt } : {}),
		attachments: attachments.map((attachment) => {
			const content = Buffer.from(String(attachment['content'] ?? ''), 'base64');
			return {
				...(attachment as unknown as IParsedInboundAttachment),
				content,
				size: content.length
			};
		})
	};
}
