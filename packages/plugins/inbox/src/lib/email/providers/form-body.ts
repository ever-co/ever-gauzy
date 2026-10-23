import { IInboundEmailAddress, IInboundWebhookRequest } from './email-provider.types';

/** A file of a provider's form webhook. */
export interface InboundFormFile {
	/** The form field it came in (`attachment-1`, `attachment1`, `email`, …). */
	field: string;
	filename: string;
	contentType?: string;
	content: Buffer;
}

/** The fields and files of a provider's form webhook. */
export interface InboundForm {
	/** Each field's first value. */
	fields: Record<string, string>;
	files: InboundFormFile[];
}

/** A request header's first value ('' when absent). */
export function headerValue(request: Pick<IInboundWebhookRequest, 'headers'>, name: string): string {
	const value = request.headers[name.toLowerCase()];
	return (Array.isArray(value) ? value[0] : value) ?? '';
}

/**
 * The fields and files of a provider's form webhook (Mailgun routes, SendGrid Inbound Parse):
 * `application/x-www-form-urlencoded`, which the API parses, or `multipart/form-data`, which the Inbox's webhook route
 * keeps raw (`rawBody`) and which is parsed here with the platform's own `FormData` (no dependency). `null` for any
 * other body, or a multipart body that does not parse.
 */
export async function readInboundForm(
	request: Pick<IInboundWebhookRequest, 'headers' | 'body' | 'rawBody'>
): Promise<InboundForm | null> {
	const type = headerValue(request, 'content-type');
	if (/^multipart\/form-data/i.test(type)) {
		if (!request.rawBody?.length) return null;
		let form: FormData;
		try {
			form = await new Response(new Uint8Array(request.rawBody), {
				headers: { 'content-type': type }
			}).formData();
		} catch {
			return null;
		}
		const fields: Record<string, string> = {};
		const files: InboundFormFile[] = [];
		for (const [field, value] of form.entries()) {
			if (typeof value === 'string') {
				if (!(field in fields)) fields[field] = value;
				continue;
			}
			files.push({
				field,
				filename: value.name || 'attachment',
				...(value.type ? { contentType: value.type } : {}),
				content: Buffer.from(await value.arrayBuffer())
			});
		}
		return { fields, files };
	}
	if (/^application\/x-www-form-urlencoded/i.test(type)) {
		const body = request.body;
		if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
		const fields: Record<string, string> = {};
		for (const [field, value] of Object.entries(body as Record<string, unknown>)) {
			const first = Array.isArray(value) ? value[0] : value;
			if (typeof first === 'string') fields[field] = first;
		}
		return { fields, files: [] };
	}
	return null;
}

/** One address of a header (`a@b`, `Name <a@b>`, `"Last, First" <a@b>`), when it has an `@`. */
function oneAddress(value: string): IInboundEmailAddress | undefined {
	const raw = value.trim();
	if (!raw) return undefined;
	const match = /^(.*?)<([^<>]+)>\s*$/.exec(raw);
	const address = (match ? (match[2] as string) : raw).trim();
	if (!address.includes('@')) return undefined;
	let name = match ? (match[1] as string).trim() : '';
	// A quoted name loses its quotes and its escapes (`"Ada \"Ace\""` is `Ada "Ace"`).
	if (/^".*"$/.test(name)) name = name.slice(1, -1).replace(/\\(.)/g, '$1');
	name = name.trim();
	return name ? { address, name } : { address };
}

/**
 * The addresses of an address-list header (`To`, `Cc`, `Reply-To`): split on the commas outside quoted names (whose
 * `\"` escapes stay inside them) and angle brackets, so `"Lovelace, Ada" <ada@acme.test>, bob@acme.test` is two
 * addresses.
 */
export function parseAddressList(value: unknown): IInboundEmailAddress[] {
	if (typeof value !== 'string' || !value.trim()) return [];
	const parts: string[] = [];
	let current = '';
	let quoted = false;
	let escaped = false;
	let angle = 0;
	for (const char of value) {
		if (escaped) {
			current += char;
			escaped = false;
			continue;
		}
		if (quoted && char === '\\') {
			current += char;
			escaped = true;
			continue;
		}
		if (char === '"') quoted = !quoted;
		else if (!quoted && char === '<') angle += 1;
		else if (!quoted && char === '>') angle = Math.max(0, angle - 1);
		if (char === ',' && !quoted && angle === 0) {
			parts.push(current);
			current = '';
			continue;
		}
		current += char;
	}
	parts.push(current);
	return parts.map(oneAddress).filter((entry): entry is IInboundEmailAddress => !!entry);
}
