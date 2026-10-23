/**
 * The message a nodemailer custom transport is handed, resolved into plain values — the part every provider API
 * transport (`createTransport` of an email provider plugin) needs, so each plugin maps fields instead of nodemailer.
 * No dependency on nodemailer's types: the mail object is read through the shape below.
 */

interface MailAddress {
	address?: string;
	name?: string;
}

/** The part of nodemailer's mail object a custom transport reads. */
export interface NodemailerMailObject {
	data: {
		subject?: string;
		html?: unknown;
		text?: unknown;
		inReplyTo?: string;
		references?: string | string[];
		headers?: Record<string, unknown> | Array<{ key: string; value: string }>;
		attachments?: Array<Record<string, unknown>>;
	};
	message: {
		messageId(): string;
		getAddresses(): {
			from?: MailAddress[];
			to?: MailAddress[];
			cc?: MailAddress[];
			bcc?: MailAddress[];
			'reply-to'?: MailAddress[];
		};
		getEnvelope?(): unknown;
	};
	resolveContent(
		target: unknown,
		key: string,
		callback: (error: Error | null, value?: Buffer | string) => void
	): void;
}

/** An address of an outbound message (CR/LF stripped). */
export interface OutboundAddress {
	address: string;
	name?: string;
}

export interface OutboundAttachment {
	filename: string;
	content: Buffer;
	contentType?: string;
	/** Inline parts are referenced from the HTML as `cid:<cid>`. */
	cid?: string;
}

/** A resolved outbound message. */
export interface ResolvedOutboundMail {
	messageId: string;
	from: OutboundAddress;
	to: OutboundAddress[];
	cc: OutboundAddress[];
	bcc: OutboundAddress[];
	replyTo: OutboundAddress[];
	subject: string;
	text?: string;
	html?: string;
	/** Custom headers, with `Message-ID`, `In-Reply-To` and `References` set from the message. */
	headers: Record<string, string>;
	attachments: OutboundAttachment[];
}

const clean = (value: string | undefined) => String(value ?? '').replace(/[\r\n]/g, '');

const addresses = (entries: MailAddress[] | undefined): OutboundAddress[] =>
	(entries ?? [])
		.filter((entry) => typeof entry.address === 'string' && entry.address)
		.map((entry) => {
			const address = clean(entry.address);
			const name = clean(entry.name);
			return name ? { address, name } : { address };
		});

/** A display name with an RFC 5322 special (a comma, a dot, `@`, …) goes in quotes, its `"` and `\` escaped. */
export function displayName(name: string): string {
	return /[()<>[\]:;@\\,."]/.test(name) ? `"${name.replace(/(["\\])/g, '\\$1')}"` : name;
}

/** `Name <address>` or `address` (the name quoted when it needs it, so a comma never splits the address). */
export function formatAddress(entry: OutboundAddress): string {
	return entry.name ? `${displayName(entry.name)} <${entry.address}>` : entry.address;
}

function resolve(mail: NodemailerMailObject, target: unknown, key: string): Promise<Buffer | string | undefined> {
	return new Promise((done, fail) => {
		const value = (target as Record<string, unknown> | undefined)?.[key];
		if (value === undefined || value === null || value === false) return done(undefined);
		mail.resolveContent(target, key, (error, content) => (error ? fail(error) : done(content)));
	});
}

const asText = (value: Buffer | string | undefined) => (Buffer.isBuffer(value) ? value.toString('utf8') : value);

/** Resolves a nodemailer mail object into plain values. Throws without a sender or a recipient. */
export async function resolveOutboundMail(
	mail: NodemailerMailObject,
	fallbackFrom?: string
): Promise<ResolvedOutboundMail> {
	const found = mail.message.getAddresses();
	const from = addresses(found.from)[0] ?? (fallbackFrom ? { address: clean(fallbackFrom) } : undefined);
	const to = addresses(found.to);
	if (!from) throw new Error('An email needs a sender.');
	if (to.length === 0) throw new Error('An email needs a recipient.');

	const headers: Record<string, string> = {};
	const stated = mail.data.headers;
	if (Array.isArray(stated)) {
		for (const { key, value } of stated) headers[clean(key)] = clean(String(value));
	} else if (stated && typeof stated === 'object') {
		for (const [key, value] of Object.entries(stated)) {
			if (typeof value === 'string') headers[clean(key)] = clean(value);
		}
	}
	const messageId = mail.message.messageId();
	headers['Message-ID'] = clean(messageId);
	if (mail.data.inReplyTo) headers['In-Reply-To'] = clean(mail.data.inReplyTo);
	const references = Array.isArray(mail.data.references) ? mail.data.references.join(' ') : mail.data.references;
	if (references) headers['References'] = clean(references);

	const attachments: OutboundAttachment[] = [];
	for (const attachment of mail.data.attachments ?? []) {
		const content = await resolve(mail, attachment, 'content');
		if (content === undefined) continue;
		attachments.push({
			filename: clean(String(attachment['filename'] ?? 'attachment')),
			content: Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8'),
			...(typeof attachment['contentType'] === 'string' ? { contentType: attachment['contentType'] } : {}),
			...(typeof attachment['cid'] === 'string' ? { cid: attachment['cid'] } : {})
		});
	}
	const html = asText(await resolve(mail, mail.data, 'html'));
	const text = asText(await resolve(mail, mail.data, 'text'));
	return {
		messageId,
		from,
		to,
		cc: addresses(found.cc),
		bcc: addresses(found.bcc),
		replyTo: addresses(found['reply-to']),
		subject: mail.data.subject ?? '',
		...(text ? { text } : {}),
		...(html ? { html } : {}),
		headers,
		attachments
	};
}

/**
 * A nodemailer custom transport over a provider's send call: `send(resolved)` answers the provider's message id.
 */
export function providerTransport(
	name: string,
	send: (mail: ResolvedOutboundMail) => Promise<{ id: string }>,
	fallbackFrom?: string
) {
	return {
		name,
		version: '1.0.0',
		send(
			mail: NodemailerMailObject,
			callback: (error: Error | null, info?: Record<string, unknown>) => void
		): void {
			resolveOutboundMail(mail, fallbackFrom)
				.then(async (resolved) => {
					const { id } = await send(resolved);
					callback(null, {
						messageId: resolved.messageId,
						envelope: mail.message.getEnvelope?.(),
						accepted: [...resolved.to, ...resolved.cc, ...resolved.bcc].map((entry) => entry.address),
						rejected: [],
						response: `${name}:${id}`,
						providerMessageId: id
					});
				})
				.catch((error: Error) => callback(error));
		}
	};
}
