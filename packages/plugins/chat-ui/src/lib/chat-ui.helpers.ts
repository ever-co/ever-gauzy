import { SecurityContext } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { marked } from 'marked';
import {
	CHAT_MENTION_TOKEN_PATTERN,
	ChatConversationKindEnum,
	IChatConversationWithState,
	IChatMessage,
	ID
} from '@gauzy/contracts';

/** Someone a mention token or an author id can be resolved to. */
export interface ChatPerson {
	employeeId: string;
	userId: string | null;
	name: string;
	imageUrl: string | null;
}

/** One piece of a rendered body: plain text, or a mention chip. */
export type ChatBodyPart =
	| { kind: 'text'; text: string }
	| { kind: 'mention'; employeeId: string; label: string; isMe: boolean }
	| { kind: 'channel'; conversationId: string; label: string }
	| { kind: 'everyone'; label: 'channel' | 'here' };

/**
 * Splits a body into text and mention chips. Mention tokens (`<@employeeId>`, `<#conversationId>`, `<!channel>`,
 * `<!here>`) are rename-safe: the chip label is looked up at render time.
 */
export function splitMentions(
	body: string,
	people: ReadonlyMap<string, ChatPerson>,
	conversations: ReadonlyMap<string, string>,
	meEmployeeId: string | null
): ChatBodyPart[] {
	const parts: ChatBodyPart[] = [];
	let last = 0;
	const pattern = new RegExp(CHAT_MENTION_TOKEN_PATTERN.source, 'g');
	for (let match = pattern.exec(body); match; match = pattern.exec(body)) {
		if (match.index > last) parts.push({ kind: 'text', text: body.slice(last, match.index) });
		const [, sigil, id, everyone] = match;
		if (everyone === 'channel' || everyone === 'here') {
			parts.push({ kind: 'everyone', label: everyone });
		} else if (sigil === '@' && id) {
			const person = people.get(id);
			parts.push({ kind: 'mention', employeeId: id, label: person?.name ?? '…', isMe: !!meEmployeeId && id === meEmployeeId });
		} else if (sigil === '#' && id) {
			parts.push({ kind: 'channel', conversationId: id, label: conversations.get(id) ?? '…' });
		}
		last = match.index + match[0].length;
	}
	if (last < body.length) parts.push({ kind: 'text', text: body.slice(last) });
	return parts;
}

/** The body with mention tokens replaced by `@Name`, for a plain-text preview (the list, a notification). */
export function plainBody(body: string, people: ReadonlyMap<string, ChatPerson>, conversations: ReadonlyMap<string, string>): string {
	return splitMentions(body, people, conversations, null)
		.map((part) => {
			if (part.kind === 'text') return part.text;
			if (part.kind === 'channel') return `#${part.label}`;
			return `@${part.label}`;
		})
		.join('')
		.replace(/\s+/g, ' ')
		.trim();
}

/** The employees a body mentions, from its tokens. */
export function mentionedEmployeeIds(body: string): string[] {
	const ids = new Set<string>();
	const pattern = new RegExp(CHAT_MENTION_TOKEN_PATTERN.source, 'g');
	for (let match = pattern.exec(body); match; match = pattern.exec(body)) {
		if (match[1] === '@' && match[2]) ids.add(match[2]);
	}
	return [...ids];
}

function escapeHtml(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The elements that load a remote URL on sight; the stored subset has none, and Angular's sanitizer keeps them. */
const REMOTE_MEDIA_TAGS = /<\/?(img|picture|source|video|audio|track)\b[^>]*>/gi;

/**
 * A body as safe HTML: the Markdown subset the API stores (paragraphs, emphasis, code, lists, quotes, links)
 * with the mention tokens as chips. The chips are put in before Markdown runs (plain HTML passes through it), the
 * whole result goes through Angular's sanitizer, so nothing a member typed can script the page, and the media
 * elements the sanitizer keeps (`img`, `picture`, `source`, `video`, `audio`, `track`) are taken out of its output:
 * the subset has none, and any of them would make every reader's browser fetch a URL of the author's choosing.
 */
export function renderBodyHtml(
	body: string,
	people: ReadonlyMap<string, ChatPerson>,
	conversations: ReadonlyMap<string, string>,
	meEmployeeId: string | null,
	sanitizer: Pick<DomSanitizer, 'sanitize'>
): string {
	const withChips = splitMentions(body, people, conversations, meEmployeeId)
		.map((part) => {
			if (part.kind === 'text') return part.text;
			if (part.kind === 'mention') {
				return `<span class="chat-mention${part.isMe ? ' chat-mention-me' : ''}">@${escapeHtml(part.label)}</span>`;
			}
			if (part.kind === 'channel') return `<span class="chat-mention">#${escapeHtml(part.label)}</span>`;
			return `<span class="chat-mention chat-mention-me">@${escapeHtml(part.label)}</span>`;
		})
		.join('');
	const html = marked.parse(withChips, { async: false, gfm: true, breaks: true }) as string;
	const safe = sanitizer.sanitize(SecurityContext.HTML, html) ?? '';
	// After the sanitizer (Angular's serializer encodes `<` inside attribute values, so a tag pattern is reliable on
	// its output); one more gate behind the sanitizer, never the only one.
	return safe.replace(REMOTE_MEDIA_TAGS, '');
}

/** The message an API refusal carries (a string, or the validation messages joined), or null when it has none. */
export function apiErrorMessage(error: unknown): string | null {
	const body = (error as { error?: { message?: unknown } } | null | undefined)?.error;
	const message = body?.message;
	if (Array.isArray(message)) {
		const text = message.filter((part) => typeof part === 'string' && part.trim()).join(' ');
		return text || null;
	}
	return typeof message === 'string' && message.trim() ? message : null;
}

// ---------------------------------------------------------------- the composer's view of mentions

/** What the composer keeps beside the text: which `@label` and `#label` stand for which id. */
export interface ComposerLabels {
	text: string;
	people: Map<string, string>;
	channels: Map<string, string>;
}

/**
 * The label a mention shows in the box, unique among the labels picked so far: two people of one name get
 * `Name` and `Name (2)`, so an edit never swaps one for the other.
 */
export function uniqueLabel(name: string, id: string, labels: ReadonlyMap<string, string>): string {
	const current = labels.get(name);
	if (current === undefined || current === id) return name;
	for (let n = 2; ; n += 1) {
		const candidate = `${name} (${n})`;
		const taken = labels.get(candidate);
		if (taken === undefined || taken === id) return candidate;
	}
}

/** The body as the person reads it while writing: tokens shown as `@Name` / `#channel`, each label mapped to its id. */
export function tokensToNames(body: string, people: ReadonlyMap<string, ChatPerson>, conversations: ReadonlyMap<string, string>): ComposerLabels {
	const picked = new Map<string, string>();
	const channels = new Map<string, string>();
	const text = splitMentions(body, people, conversations, null)
		.map((part) => {
			if (part.kind === 'text') return part.text;
			if (part.kind === 'mention') {
				const label = uniqueLabel(part.label, part.employeeId, picked);
				picked.set(label, part.employeeId);
				return `@${label}`;
			}
			if (part.kind === 'channel') {
				const label = uniqueLabel(part.label, part.conversationId, channels);
				channels.set(label, part.conversationId);
				return `#${label}`;
			}
			return `@${part.label}`;
		})
		.join('');
	return { text, people: picked, channels };
}

/**
 * `@Name` back into `<@employeeId>` and `#channel` into `<#conversationId>` for the labels that were picked
 * (longest first, a label never matched inside a longer word), plus `@channel` / `@here` into `<!channel>` / `<!here>`.
 */
export function namesToTokens(text: string, people: ReadonlyMap<string, string>, channels: ReadonlyMap<string, string> = new Map()): string {
	let out = text;
	const byLength = (a: [string, string], b: [string, string]) => b[0].length - a[0].length;
	for (const [label, id] of [...people.entries()].sort(byLength)) {
		out = out.replace(new RegExp(`@${escapeRegExp(label)}(?![\\p{L}\\p{N}_])`, 'gu'), `<@${id}>`);
	}
	for (const [label, id] of [...channels.entries()].sort(byLength)) {
		out = out.replace(new RegExp(`#${escapeRegExp(label)}(?![\\p{L}\\p{N}_])`, 'gu'), `<#${id}>`);
	}
	return out.replace(/(^|\s)@(channel|here)(?=\s|$|[.,!?])/g, '$1<!$2>');
}

/**
 * The `@` query under the caret, when the caret follows `@` and some word characters with no space in between:
 * what the suggestion list filters on, and where the chosen token replaces.
 */
export function mentionQueryAt(text: string, caret: number): { query: string; start: number } | null {
	const before = text.slice(0, caret);
	const match = /(^|\s)@([^\s@]*)$/.exec(before);
	if (!match) return null;
	return { query: match[2], start: caret - match[2].length - 1 };
}

/** The people whose name matches a query, the ones whose name starts with it first, a few at most. */
export function suggestMentions(people: readonly ChatPerson[], query: string, limit = 8): ChatPerson[] {
	const needle = query.trim().toLowerCase();
	return people
		.filter((person) => !needle || person.name.toLowerCase().includes(needle))
		.sort((a, b) => {
			const aStarts = a.name.toLowerCase().startsWith(needle) ? 0 : 1;
			const bStarts = b.name.toLowerCase().startsWith(needle) ? 0 : 1;
			return aStarts - bStarts || a.name.localeCompare(b.name);
		})
		.slice(0, limit);
}

/** The name a conversation shows: its name, or the other people of a direct / group conversation. */
export function conversationTitle(
	conversation: Pick<IChatConversationWithState, 'kind' | 'name' | 'members'>,
	people: ReadonlyMap<string, ChatPerson>,
	meEmployeeId: string | null,
	fallback: string
): string {
	if (conversation.kind === ChatConversationKindEnum.CHANNEL) return conversation.name ? `#${conversation.name}` : fallback;
	const others = (conversation.members ?? []).filter((member) => String(member.employeeId) !== String(meEmployeeId ?? ''));
	const names = others.map((member) => people.get(String(member.employeeId))?.name).filter((name): name is string => !!name);
	if (names.length) return names.join(', ');
	return conversation.name ?? fallback;
}

/** Whether a conversation counts as unread for the list and the badges. */
export function isUnread(conversation: Pick<IChatConversationWithState, 'state'>): boolean {
	return (conversation.state?.unreadCount ?? 0) > 0 || (conversation.state?.mentionCount ?? 0) > 0;
}

/** The conversations in sidebar order: favourites, then by the newest message. */
export function sortConversations(conversations: readonly IChatConversationWithState[]): IChatConversationWithState[] {
	return [...conversations].sort((a, b) => {
		const favorite = Number(!!b.state?.isFavorite) - Number(!!a.state?.isFavorite);
		if (favorite) return favorite;
		const at = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
		const bt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
		return bt - at || String(a.name ?? '').localeCompare(String(b.name ?? ''));
	});
}

/** Whether two consecutive messages are grouped under one author header (same author, within five minutes). */
export function continuesGroup(previous: IChatMessage | undefined, message: IChatMessage): boolean {
	if (!previous || previous.authorUserId !== message.authorUserId || previous.deletedAt || message.replyToId) return false;
	if (previous.kind !== message.kind) return false;
	return new Date(message.createdAt as Date).getTime() - new Date(previous.createdAt as Date).getTime() < 5 * 60 * 1000;
}

/** A fresh idempotency key for a send: a UUID (version 4), as the API's `nonce` contract asks. */
export function newNonce(): string {
	const api = globalThis.crypto as { randomUUID?: () => string; getRandomValues?: (array: Uint8Array) => Uint8Array } | undefined;
	if (api?.randomUUID) return api.randomUUID();
	const bytes = new Uint8Array(16);
	if (api?.getRandomValues) api.getRandomValues(bytes);
	else for (let at = 0; at < bytes.length; at += 1) bytes[at] = Math.floor(Math.random() * 256);
	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Inserts the messages of a page into a list (by id, newest last), keeping the list ordered by time. */
export function mergeMessages<T extends IChatMessage>(existing: readonly T[], incoming: readonly T[]): T[] {
	const byId = new Map<ID, T>(existing.map((message) => [message.id, message]));
	for (const message of incoming) byId.set(message.id, message);
	return [...byId.values()].sort(
		(a, b) =>
			new Date(a.createdAt as Date).getTime() - new Date(b.createdAt as Date).getTime() || String(a.id).localeCompare(String(b.id))
	);
}

/** The text of the header badge: nothing at zero, `99+` past ninety-nine. */
export function badgeText(count: number): string {
	if (!Number.isFinite(count) || count <= 0) return '';
	return count > 99 ? '99+' : String(Math.floor(count));
}

/** The initials an avatar shows for a name without a picture. */
export function initialsOf(name: string): string {
	const words = name.trim().split(/\s+/).filter(Boolean);
	if (words.length === 0) return '?';
	return words
		.slice(0, 2)
		.map((word) => word[0]?.toUpperCase() ?? '')
		.join('');
}

/** A user's display name: first and last name, else the stored name, else the email. */
export function userName(user: { firstName?: string | null; lastName?: string | null; name?: string | null; email?: string | null } | null | undefined): string {
	const name = [user?.firstName, user?.lastName].filter((part) => !!part && String(part).trim()).join(' ');
	return name || user?.name || user?.email || '';
}
