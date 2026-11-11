import {
	CHAT_MESSAGE_MAX_LENGTH,
	CHAT_WEBHOOK_MAX_BLOCKS,
	CHAT_WEBHOOK_MAX_BUTTONS,
	CHAT_WEBHOOK_MAX_FIELDS,
	CHAT_WEBHOOK_MAX_PAYLOAD_BYTES,
	ChatAppBlockTypeEnum,
	ChatAppButtonStyle,
	IChatAppBlock,
	IChatAppButton
} from '@gauzy/contracts';
import { getUnsafeOutboundUrlReason } from '@gauzy/utils';

/**
 * A webhook post, read: the widely used JSON shape of chat bots (`text`, `blocks`, legacy `attachments`) turned into
 * a chat message body and the plugin's own block subset (`IChatAppBlock`), plain text throughout.
 *
 * Pure (no I/O): every rule of the receive route about what a payload may hold lives here, so it is tested on its own.
 */

/** Why a payload was refused, as the receive route answers it (status 422, the code as the body). */
export type ChatWebhookPayloadErrorCode = 'invalid_payload' | 'payload_too_large' | 'too_many_blocks' | 'invalid_blocks' | 'no_text';

export class ChatWebhookPayloadError extends Error {
	constructor(
		readonly code: ChatWebhookPayloadErrorCode,
		message: string
	) {
		super(message);
		this.name = 'ChatWebhookPayloadError';
	}
}

/** What a payload becomes. */
export interface IChatWebhookContent {
	/** The message body: the payload's `text`, or the text of its blocks; markdown subset with mention tokens. */
	body: string;
	blocks: IChatAppBlock[];
	/** The sender's idempotency key, when it gave one. */
	nonce: string | null;
}

export interface IChatWebhookPayloadOptions {
	/** Whether `<!channel>` / `<!here>` / `<!everyone>` stay broadcast tokens (otherwise they become plain text). */
	canBroadcast: boolean;
	/** The `Idempotency-Key` header, used when the payload carries no `nonce`. */
	idempotencyKey?: string | null;
}

/** Text lengths, cut with an ellipsis beyond them (a long text is not a reason to lose a post). */
export const CHAT_APP_TEXT_LIMITS = {
	header: 150,
	section: 3000,
	field: 2000,
	context: 300,
	buttonText: 75,
	buttonValue: 2000,
	id: 255,
	text: 3000
} as const;

/** The most elements a context block shows. */
export const CHAT_APP_MAX_CONTEXT_ELEMENTS = 10;
/** The longest idempotency key (the message's `nonce` column). */
export const CHAT_WEBHOOK_MAX_NONCE_LENGTH = 64;

const UUID = '[0-9a-fA-F-]{36}';
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩]/g;
const HTML_TAG = /^\/?[a-zA-Z][\w:-]*(\s[^>]*)?\/?$/;

/**
 * The object a request body holds: a JSON body as parsed, or a form body's `payload` field (the form flavour of the
 * same shape) parsed as JSON. Anything else is refused.
 *
 * @throws ChatWebhookPayloadError (`invalid_payload`).
 */
export function payloadObjectOf(body: unknown): Record<string, unknown> {
	let value = body;
	if (isRecord(value) && typeof value['payload'] === 'string' && Object.keys(value).length === 1) {
		try {
			value = JSON.parse(value['payload'] as string);
		} catch {
			throw new ChatWebhookPayloadError('invalid_payload', 'The payload field is not JSON.');
		}
	}
	if (!isRecord(value)) {
		throw new ChatWebhookPayloadError('invalid_payload', 'The body must be a JSON object.');
	}
	return value;
}

/**
 * Refuses a body over the size limit (the raw bytes as received; the parsed body re-serialised when the raw bytes
 * are not at hand).
 *
 * @throws ChatWebhookPayloadError (`payload_too_large`).
 */
export function assertPayloadSize(rawLength: number): void {
	if (rawLength > CHAT_WEBHOOK_MAX_PAYLOAD_BYTES) {
		throw new ChatWebhookPayloadError('payload_too_large', `A webhook post holds at most ${CHAT_WEBHOOK_MAX_PAYLOAD_BYTES} bytes.`);
	}
}

/**
 * Reads a payload into the body and blocks of an app message.
 *
 * - `text` is the body (links `<url|label>` become markdown links, HTML is dropped, broadcast tokens follow
 *   `canBroadcast`); without it, the body is the text of the blocks, and then the attachments' `fallback`.
 * - `blocks`: header, section (text, fields, a button accessory), divider, context, actions (buttons); any other
 *   type becomes a `text` block with whatever text it had (none: dropped). Our own normalised shape is read too.
 * - `attachments`: each one's blocks, or its pretext, author, title, text, fields, buttons and footer as blocks.
 * - `username`, `icon_url`, `icon_emoji` and `channel` are ignored: the webhook's own name, icon and channel apply.
 *
 * @throws ChatWebhookPayloadError with the code the route answers.
 */
export function normalizeWebhookPayload(payload: Record<string, unknown>, options: IChatWebhookPayloadOptions): IChatWebhookContent {
	const nonce = nonceOf(payload['nonce'], options.idempotencyKey);
	const rawBlocks = payload['blocks'];
	const rawAttachments = payload['attachments'];
	if (rawBlocks !== undefined && rawBlocks !== null && !Array.isArray(rawBlocks)) {
		throw new ChatWebhookPayloadError('invalid_payload', 'blocks must be an array.');
	}
	if (rawAttachments !== undefined && rawAttachments !== null && !Array.isArray(rawAttachments)) {
		throw new ChatWebhookPayloadError('invalid_payload', 'attachments must be an array.');
	}
	if (payload['text'] !== undefined && payload['text'] !== null && typeof payload['text'] !== 'string') {
		throw new ChatWebhookPayloadError('invalid_payload', 'text must be a string.');
	}
	const inputBlocks = (rawBlocks as unknown[] | undefined) ?? [];
	if (inputBlocks.length > CHAT_WEBHOOK_MAX_BLOCKS) {
		throw new ChatWebhookPayloadError('too_many_blocks', `A post carries at most ${CHAT_WEBHOOK_MAX_BLOCKS} blocks.`);
	}

	const blocks: IChatAppBlock[] = [];
	for (const block of inputBlocks) blocks.push(...normalizeBlock(block));
	let fallback = '';
	for (const attachment of (rawAttachments as unknown[] | undefined) ?? []) {
		if (!isRecord(attachment)) continue;
		blocks.push(...attachmentBlocks(attachment));
		if (!fallback && typeof attachment['fallback'] === 'string') fallback = plainText(attachment['fallback'], CHAT_APP_TEXT_LIMITS.text);
		if (blocks.length > CHAT_WEBHOOK_MAX_BLOCKS) break;
	}
	if (blocks.length > CHAT_WEBHOOK_MAX_BLOCKS) {
		throw new ChatWebhookPayloadError('too_many_blocks', `A post carries at most ${CHAT_WEBHOOK_MAX_BLOCKS} blocks.`);
	}
	assertUniqueActions(blocks);

	const text = typeof payload['text'] === 'string' ? bodyText(payload['text'], options.canBroadcast) : '';
	const body = cut(text || blocksText(blocks) || fallback, CHAT_MESSAGE_MAX_LENGTH);
	if (!body) {
		throw new ChatWebhookPayloadError('no_text', 'A post needs text, or blocks with text.');
	}
	return { body, blocks, nonce };
}

/**
 * The reply of an interaction URL, read the same way as a post: `{ text?, blocks?, attachments?, replace_original? }`.
 * Null when it asks for nothing (no content, `replace_original: false`, or not an object).
 */
export function normalizeInteractionReply(reply: unknown, options: Pick<IChatWebhookPayloadOptions, 'canBroadcast'>): IChatWebhookContent | null {
	if (!isRecord(reply)) return null;
	if (reply['replace_original'] === false || reply['replaceOriginal'] === false) return null;
	const hasContent = ['text', 'blocks', 'attachments'].some((key) => reply[key] !== undefined && reply[key] !== null);
	if (!hasContent) return null;
	const { nonce: _ignored, ...rest } = reply;
	return normalizeWebhookPayload(rest, { canBroadcast: options.canBroadcast });
}

// ---------------------------------------------------------------- text

/**
 * The text of a body: control characters dropped, `<url|label>` → `[label](url)`, `<url>` → url, the chat's own
 * mention tokens kept (`<!channel>` / `<!here>` only with `canBroadcast`, `<!everyone>` read as `<!channel>`), other
 * `<…>` sequences of the shape reduced to their label, HTML tags removed, `&lt;` `&gt;` `&amp;` decoded, then tags
 * removed again (a decoded `&lt;b&gt;` is not markup either).
 */
export function bodyText(value: string, canBroadcast: boolean): string {
	return finish(rewriteAngles(clean(value), 'body', canBroadcast));
}

/** Plain text for a block: as `bodyText`, links as `label (url)`, broadcast tokens as `@channel` / `@here`. */
export function plainText(value: unknown, max: number): string {
	if (typeof value !== 'string') return '';
	return cut(finish(rewriteAngles(clean(value), 'plain', false)), max);
}

function clean(value: string): string {
	return value.replace(/\r\n?/g, '\n').replace(CONTROL, '');
}

function finish(value: string): string {
	const decoded = stripTags(stripTags(value).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
	return decoded.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Removes HTML comments, declarations and tags; leaves the chat's mention tokens and any other text. */
function stripTags(value: string): string {
	return value
		.replace(/<!--[\s\S]*?(-->|$)/g, '')
		.replace(/<(![^>]*|\/?[a-zA-Z][^<>]*)>/g, (whole, inner: string) => (isChatToken(whole) || !(inner.startsWith('!') || HTML_TAG.test(inner)) ? whole : ''));
}

function isChatToken(token: string): boolean {
	return new RegExp(`^<(@|#)${UUID}>$`).test(token) || token === '<!channel>' || token === '<!here>';
}

function rewriteAngles(value: string, mode: 'body' | 'plain', canBroadcast: boolean): string {
	return value.replace(/<([^<>\n]{1,2048})>/g, (whole: string, inner: string) => {
		if (new RegExp(`^(@|#)${UUID}$`).test(inner)) return whole;
		const [target, ...labelParts] = inner.split('|');
		const label = labelParts.join('|').trim();
		if (/^https?:\/\//i.test(target)) {
			const url = target.trim();
			if (!label) return url;
			return mode === 'body' ? `[${label.replace(/[[\]]/g, '')}](${url.replace(/[()\s]/g, encodeURIComponent)})` : `${label} (${url})`;
		}
		if (/^mailto:/i.test(target)) return label || target.slice('mailto:'.length);
		if (target.startsWith('@')) return `@${label || target.slice(1)}`;
		if (target.startsWith('#')) return `#${label || target.slice(1)}`;
		if (target.startsWith('!')) {
			const name = target.slice(1).split('^')[0].toLowerCase();
			if (name === 'channel' || name === 'here' || name === 'everyone') {
				const token = name === 'here' ? 'here' : 'channel';
				return mode === 'body' && canBroadcast ? `<!${token}>` : `@${name}`;
			}
			return label;
		}
		// Not a sequence of the shape: an HTML tag (removed later), or text that happens to sit between < and >.
		return whole;
	});
}

function cut(value: string, max: number): string {
	if (value.length <= max) return value;
	return `${value.slice(0, max - 1).trimEnd()}…`;
}

/** The text a payload object or string carries: `"…"`, `{ text: "…" }`, `{ text: { text: "…" } }`. */
function textOf(value: unknown): unknown {
	if (typeof value === 'string') return value;
	if (isRecord(value)) {
		const inner = value['text'];
		if (typeof inner === 'string') return inner;
		if (isRecord(inner) && typeof inner['text'] === 'string') return inner['text'];
	}
	return undefined;
}

/** Every text inside an unknown block (rich text and the like), in order, joined by spaces. */
function nestedText(value: unknown, depth = 0): string {
	if (depth > 6) return '';
	if (typeof value === 'string') return '';
	if (Array.isArray(value)) return value.map((item) => nestedText(item, depth + 1)).filter(Boolean).join(' ');
	if (!isRecord(value)) return '';
	const own = typeof value['text'] === 'string' ? (value['text'] as string) : '';
	const parts = [own];
	for (const key of ['text', 'elements', 'fields', 'title', 'alt_text']) {
		const child = value[key];
		if (key === 'title' || key === 'alt_text') {
			const titled = textOf(child);
			if (typeof titled === 'string' && !own) parts.push(titled);
			continue;
		}
		if (typeof child !== 'string') parts.push(nestedText(child, depth + 1));
	}
	return parts.filter(Boolean).join(' ');
}

// ---------------------------------------------------------------- blocks

function normalizeBlock(block: unknown): IChatAppBlock[] {
	if (!isRecord(block)) return [];
	const type = typeof block['type'] === 'string' ? (block['type'] as string).toLowerCase() : '';
	switch (type) {
		case 'header': {
			const text = plainText(textOf(block), CHAT_APP_TEXT_LIMITS.header);
			return text ? [{ type: ChatAppBlockTypeEnum.HEADER, text }] : [];
		}
		case 'section': {
			const text = plainText(textOf(block), CHAT_APP_TEXT_LIMITS.section) || null;
			const rawFields = Array.isArray(block['fields']) ? (block['fields'] as unknown[]) : [];
			if (rawFields.length > CHAT_WEBHOOK_MAX_FIELDS) {
				throw new ChatWebhookPayloadError('invalid_blocks', `A section shows at most ${CHAT_WEBHOOK_MAX_FIELDS} fields.`);
			}
			const fields = rawFields.map((field) => plainText(textOf(field), CHAT_APP_TEXT_LIMITS.field)).filter(Boolean);
			const out: IChatAppBlock[] = [];
			if (text || fields.length) out.push({ type: ChatAppBlockTypeEnum.SECTION, text, fields: fields.length ? fields : null });
			const accessory = block['accessory'];
			const button = isRecord(accessory) ? buttonOf(accessory, `${blockIdOf(block) ?? 'section'}-accessory`) : null;
			if (button) out.push({ type: ChatAppBlockTypeEnum.ACTIONS, blockId: blockIdOf(block), elements: [button] });
			return out;
		}
		case 'divider':
			return [{ type: ChatAppBlockTypeEnum.DIVIDER }];
		case 'context': {
			const elements = (Array.isArray(block['elements']) ? (block['elements'] as unknown[]) : [])
				.slice(0, CHAT_APP_MAX_CONTEXT_ELEMENTS)
				.map((element) => plainText(textOf(element) ?? (isRecord(element) ? element['alt_text'] : undefined), CHAT_APP_TEXT_LIMITS.context))
				.filter(Boolean);
			return elements.length ? [{ type: ChatAppBlockTypeEnum.CONTEXT, elements }] : [];
		}
		case 'actions': {
			const raw = Array.isArray(block['elements']) ? (block['elements'] as unknown[]) : [];
			const blockId = blockIdOf(block);
			const buttons = raw
				.map((element, index) => (isRecord(element) ? buttonOf(element, `${blockId ?? 'actions'}-${index}`) : null))
				.filter((button): button is IChatAppButton => !!button);
			if (buttons.length > CHAT_WEBHOOK_MAX_BUTTONS) {
				throw new ChatWebhookPayloadError('invalid_blocks', `An actions block carries at most ${CHAT_WEBHOOK_MAX_BUTTONS} buttons.`);
			}
			return buttons.length ? [{ type: ChatAppBlockTypeEnum.ACTIONS, blockId, elements: buttons }] : [];
		}
		case 'text': {
			const text = plainText(textOf(block), CHAT_APP_TEXT_LIMITS.text);
			return text ? [{ type: ChatAppBlockTypeEnum.TEXT, text }] : [];
		}
		default: {
			// Not in the subset: shown as the text it holds, or not at all.
			const direct = textOf(block);
			const text = plainText(typeof direct === 'string' ? direct : nestedText(block), CHAT_APP_TEXT_LIMITS.text);
			return text ? [{ type: ChatAppBlockTypeEnum.TEXT, text }] : [];
		}
	}
}

/** A button element (`{ type: 'button', action_id, text, value, url, style }`, or our own shape), else null. */
function buttonOf(element: Record<string, unknown>, fallbackId: string): IChatAppButton | null {
	if (element['type'] !== undefined && element['type'] !== 'button') return null;
	const text = plainText(textOf(element), CHAT_APP_TEXT_LIMITS.buttonText);
	if (!text) return null;
	const rawId = element['action_id'] ?? element['actionId'] ?? element['name'];
	const actionId = typeof rawId === 'string' && rawId.trim() ? cut(rawId.trim().replace(CONTROL, ''), CHAT_APP_TEXT_LIMITS.id) : fallbackId;
	const rawValue = element['value'];
	const value = typeof rawValue === 'string' ? rawValue.replace(CONTROL, '').slice(0, CHAT_APP_TEXT_LIMITS.buttonValue) : null;
	const url = typeof element['url'] === 'string' ? element['url'].trim() : null;
	if (url && getUnsafeOutboundUrlReason(url) !== null) {
		throw new ChatWebhookPayloadError('invalid_blocks', 'A button link must be an https URL of a public host.');
	}
	const style = element['style'] === 'primary' || element['style'] === 'danger' ? (element['style'] as ChatAppButtonStyle) : null;
	return { actionId, text, value, url: url || null, style };
}

function blockIdOf(block: Record<string, unknown>): string | null {
	const raw = block['block_id'] ?? block['blockId'];
	return typeof raw === 'string' && raw.trim() ? cut(raw.trim().replace(CONTROL, ''), CHAT_APP_TEXT_LIMITS.id) : null;
}

/** Two buttons of one actions block may not share an action id: a click could not say which one it was. */
function assertUniqueActions(blocks: readonly IChatAppBlock[]): void {
	for (const block of blocks) {
		if (block.type !== ChatAppBlockTypeEnum.ACTIONS) continue;
		const ids = new Set<string>();
		for (const button of block.elements) {
			if (ids.has(button.actionId)) {
				throw new ChatWebhookPayloadError('invalid_blocks', 'Two buttons of one actions block share an action id.');
			}
			ids.add(button.actionId);
		}
	}
}

/** A legacy attachment as blocks: its own `blocks`, else pretext, author, title, text, fields, buttons, footer. */
function attachmentBlocks(attachment: Record<string, unknown>): IChatAppBlock[] {
	if (Array.isArray(attachment['blocks'])) {
		return (attachment['blocks'] as unknown[]).flatMap((block) => normalizeBlock(block));
	}
	const out: IChatAppBlock[] = [];
	const pretext = plainText(attachment['pretext'], CHAT_APP_TEXT_LIMITS.section);
	if (pretext) out.push({ type: ChatAppBlockTypeEnum.SECTION, text: pretext, fields: null });
	const author = plainText(attachment['author_name'], CHAT_APP_TEXT_LIMITS.context);
	if (author) out.push({ type: ChatAppBlockTypeEnum.CONTEXT, elements: [author] });
	const title = plainText(attachment['title'], CHAT_APP_TEXT_LIMITS.header);
	if (title) {
		const link = typeof attachment['title_link'] === 'string' && getUnsafeOutboundUrlReason(attachment['title_link']) === null ? attachment['title_link'] : null;
		out.push({ type: ChatAppBlockTypeEnum.HEADER, text: link ? cut(`${title} (${link})`, CHAT_APP_TEXT_LIMITS.section) : title });
	}
	const text = plainText(attachment['text'], CHAT_APP_TEXT_LIMITS.section) || null;
	const rawFields = Array.isArray(attachment['fields']) ? (attachment['fields'] as unknown[]) : [];
	if (rawFields.length > CHAT_WEBHOOK_MAX_FIELDS) {
		throw new ChatWebhookPayloadError('invalid_blocks', `An attachment shows at most ${CHAT_WEBHOOK_MAX_FIELDS} fields.`);
	}
	const fields = rawFields
		.map((field) => {
			if (!isRecord(field)) return '';
			const name = plainText(field['title'], CHAT_APP_TEXT_LIMITS.field);
			const value = plainText(field['value'], CHAT_APP_TEXT_LIMITS.field);
			return cut([name, value].filter(Boolean).join('\n'), CHAT_APP_TEXT_LIMITS.field);
		})
		.filter(Boolean);
	if (text || fields.length) out.push({ type: ChatAppBlockTypeEnum.SECTION, text, fields: fields.length ? fields : null });
	const actions = Array.isArray(attachment['actions']) ? (attachment['actions'] as unknown[]) : [];
	const buttons = actions
		.map((action, index) => (isRecord(action) ? buttonOf(action, `attachment-${index}`) : null))
		.filter((button): button is IChatAppButton => !!button);
	if (buttons.length > CHAT_WEBHOOK_MAX_BUTTONS) {
		throw new ChatWebhookPayloadError('invalid_blocks', `An attachment carries at most ${CHAT_WEBHOOK_MAX_BUTTONS} buttons.`);
	}
	if (buttons.length) out.push({ type: ChatAppBlockTypeEnum.ACTIONS, blockId: null, elements: buttons });
	const footer = plainText(attachment['footer'], CHAT_APP_TEXT_LIMITS.context);
	if (footer) out.push({ type: ChatAppBlockTypeEnum.CONTEXT, elements: [footer] });
	return out;
}

/** The text of the blocks, for the body of a post that has no `text` (and for search and notifications). */
export function blocksText(blocks: readonly IChatAppBlock[]): string {
	const lines: string[] = [];
	for (const block of blocks) {
		if (block.type === ChatAppBlockTypeEnum.HEADER || block.type === ChatAppBlockTypeEnum.TEXT) lines.push(block.text);
		else if (block.type === ChatAppBlockTypeEnum.SECTION) {
			if (block.text) lines.push(block.text);
			if (block.fields?.length) lines.push(block.fields.join('\n'));
		} else if (block.type === ChatAppBlockTypeEnum.CONTEXT) lines.push(block.elements.join(' · '));
	}
	return lines.join('\n').trim();
}

/** The stored button a click names: by action id, and by block id when given. */
export function findButton(blocks: readonly IChatAppBlock[], actionId: string, blockId?: string | null): { button: IChatAppButton; blockId: string | null } | null {
	for (const block of blocks) {
		if (block.type !== ChatAppBlockTypeEnum.ACTIONS) continue;
		if (blockId && block.blockId !== blockId) continue;
		const button = block.elements.find((element) => element.actionId === actionId);
		if (button) return { button, blockId: block.blockId ?? null };
	}
	return null;
}

/** The blocks stored on a message (JSON text), or none. */
export function blocksOf(json: string | null | undefined): IChatAppBlock[] {
	if (!json) return [];
	try {
		const parsed = JSON.parse(json);
		return Array.isArray(parsed) ? (parsed as IChatAppBlock[]) : [];
	} catch {
		return [];
	}
}

function nonceOf(raw: unknown, header: string | null | undefined): string | null {
	const value = typeof raw === 'string' && raw.trim() ? raw.trim() : typeof header === 'string' && header.trim() ? header.trim() : null;
	if (value === null) return null;
	if (value.length > CHAT_WEBHOOK_MAX_NONCE_LENGTH || CONTROL.test(value)) {
		CONTROL.lastIndex = 0;
		throw new ChatWebhookPayloadError('invalid_payload', `A nonce holds at most ${CHAT_WEBHOOK_MAX_NONCE_LENGTH} printable characters.`);
	}
	return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
