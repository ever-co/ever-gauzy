import { ResendApiClient, ResendSendRequest } from './resend-api.client';

/** The part of nodemailer's mail object a custom transport reads (no dependency on nodemailer's types). */
interface MailAddress {
	address?: string;
	name?: string;
}
interface MailData {
	subject?: string;
	html?: unknown;
	text?: unknown;
	inReplyTo?: string;
	references?: string | string[];
	headers?: Record<string, unknown> | Array<{ key: string; value: string }>;
	attachments?: Array<Record<string, unknown>>;
}
export interface NodemailerMail {
	data: MailData;
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

/** What the transport answers nodemailer (its `sendMail` result). */
export interface ResendSendInfo {
	messageId: string;
	envelope?: unknown;
	accepted: string[];
	rejected: string[];
	response: string;
	resendId: string;
}

const format = (entry: MailAddress) =>
	entry.name ? `${entry.name.replace(/["\r\n]/g, '')} <${entry.address}>` : String(entry.address);
const list = (entries: MailAddress[] | undefined) =>
	(entries ?? []).filter((entry) => typeof entry.address === 'string' && entry.address).map(format);

function resolve(mail: NodemailerMail, target: unknown, key: string): Promise<Buffer | string | undefined> {
	return new Promise((done, fail) => {
		const value = (target as Record<string, unknown> | undefined)?.[key];
		if (value === undefined || value === null || value === false) return done(undefined);
		mail.resolveContent(target, key, (error, content) => (error ? fail(error) : done(content)));
	});
}

const toText = (value: Buffer | string | undefined) => (Buffer.isBuffer(value) ? value.toString('utf8') : value);

/**
 * A nodemailer custom transport that sends through Resend's API (`POST /emails`), for the core transport seam (plan 04
 * §5.5). The `Message-ID` nodemailer generated is the idempotency key, so a retried send does not go out twice; the
 * threading headers (`In-Reply-To`, `References`) are passed as custom headers.
 */
export function createResendTransport(client: ResendApiClient, fromAddress?: string) {
	return {
		name: 'resend',
		version: '1.0.0',
		send(mail: NodemailerMail, callback: (error: Error | null, info?: ResendSendInfo) => void): void {
			buildRequest(mail, fromAddress)
				.then(async (request) => {
					const messageId = mail.message.messageId();
					const { id } = await client.send(request, messageId);
					callback(null, {
						messageId,
						envelope: mail.message.getEnvelope?.(),
						accepted: [...request.to, ...(request.cc ?? []), ...(request.bcc ?? [])],
						rejected: [],
						response: `resend:${id}`,
						resendId: id
					});
				})
				.catch((error: Error) => callback(error));
		}
	};
}

/** The Resend request of a nodemailer message. */
export async function buildRequest(mail: NodemailerMail, fromAddress?: string): Promise<ResendSendRequest> {
	const addresses = mail.message.getAddresses();
	const from = list(addresses.from)[0] ?? fromAddress;
	const to = list(addresses.to);
	if (!from) throw new Error('A Resend email needs a sender.');
	if (to.length === 0) throw new Error('A Resend email needs a recipient.');

	const headers: Record<string, string> = {};
	const stated = mail.data.headers;
	if (Array.isArray(stated)) {
		for (const { key, value } of stated) headers[key] = String(value);
	} else if (stated && typeof stated === 'object') {
		for (const [key, value] of Object.entries(stated)) {
			if (typeof value === 'string') headers[key] = value;
		}
	}
	// The Message-ID the sender stored (an Inbox reply keeps it in its thread), so the delivered email carries it.
	headers['Message-ID'] = mail.message.messageId();
	if (mail.data.inReplyTo) headers['In-Reply-To'] = mail.data.inReplyTo;
	const references = Array.isArray(mail.data.references) ? mail.data.references.join(' ') : mail.data.references;
	if (references) headers['References'] = references;

	const attachments: NonNullable<ResendSendRequest['attachments']> = [];
	for (const attachment of mail.data.attachments ?? []) {
		const content = await resolve(mail, attachment, 'content');
		if (content === undefined) continue;
		attachments.push({
			filename: String(attachment['filename'] ?? 'attachment'),
			content: (Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8')).toString('base64'),
			...(typeof attachment['contentType'] === 'string' ? { content_type: attachment['contentType'] } : {}),
			...(typeof attachment['cid'] === 'string' ? { content_id: attachment['cid'] } : {})
		});
	}

	const html = toText(await resolve(mail, mail.data, 'html'));
	const text = toText(await resolve(mail, mail.data, 'text'));
	const cc = list(addresses.cc);
	const bcc = list(addresses.bcc);
	const replyTo = list(addresses['reply-to']);
	return {
		from,
		to,
		...(cc.length ? { cc } : {}),
		...(bcc.length ? { bcc } : {}),
		...(replyTo.length ? { reply_to: replyTo } : {}),
		subject: mail.data.subject ?? '',
		...(html ? { html } : {}),
		...(text ? { text } : {}),
		...(Object.keys(headers).length ? { headers } : {}),
		...(attachments.length ? { attachments } : {})
	};
}
