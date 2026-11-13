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
	/** Their position in the organization (e.g. "Frontend Developer"), when one is set. */
	position?: string | null;
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

/**
 * What a message reads as in one line (a thread in the list, a quote): its text, or — for a message of files only —
 * a clip and its files' names as the platform recorded them (`📎 report.pdf, chart.png`).
 */
export function messagePreview(
	message: { body?: string | null; attachmentNames?: string | null },
	people: ReadonlyMap<string, ChatPerson>,
	conversations: ReadonlyMap<string, string>
): string {
	const text = plainBody(message.body ?? '', people, conversations);
	if (text) return text;
	const names = (message.attachmentNames ?? '')
		.split(/\r?\n/)
		.map((name) => name.trim())
		.filter(Boolean);
	return names.length ? `📎 ${names.join(', ')}` : '';
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

/** The class of a mention chip that names its person: `chat-person-<employeeId>`. */
export const CHAT_PERSON_CLASS_PREFIX = 'chat-person-';
const PERSON_ID = /^[A-Za-z0-9-]+$/;

/**
 * The person an element of the page stands for, for the profile card: an avatar or a name marked
 * `data-person-id`, or a mention chip of a body (its `chat-person-<id>` class); the nearest one around the target.
 */
export function personTriggerOf(target: EventTarget | null): { element: Element; employeeId: string } | null {
	const element = (target as Element | null)?.closest?.('[data-person-id], .chat-mention-person') ?? null;
	if (!element) return null;
	const marked = element.getAttribute('data-person-id');
	const fromClass = [...element.classList].find((name) => name.startsWith(CHAT_PERSON_CLASS_PREFIX))?.slice(CHAT_PERSON_CLASS_PREFIX.length);
	const employeeId = marked || fromClass || null;
	// The same shape `renderBodyHtml` writes: anything else read from the page is not a person.
	return employeeId && PERSON_ID.test(employeeId) ? { element, employeeId } : null;
}

/** The profile card's width in px (`PersonCardComponent`, 18.5rem), and its distance from the person and the window edges. */
export const PERSON_CARD_WIDTH_PX = 296;
export const PERSON_CARD_GAP_PX = 8;

/**
 * Where the profile card goes (viewport px): beside the person, right of them, else left of them, else over them
 * held inside the window; its top level with theirs, moved up when it would run off the bottom.
 */
export function cardPlace(
	rect: Pick<DOMRect, 'top' | 'left' | 'right'>,
	height: number,
	viewport: { width: number; height: number }
): { top: number; left: number } {
	const margin = PERSON_CARD_GAP_PX;
	let left = rect.right + PERSON_CARD_GAP_PX;
	if (left + PERSON_CARD_WIDTH_PX > viewport.width - margin) left = rect.left - PERSON_CARD_WIDTH_PX - PERSON_CARD_GAP_PX;
	if (left < margin) left = Math.min(Math.max(rect.left, margin), viewport.width - PERSON_CARD_WIDTH_PX - margin);
	const top = Math.max(margin, Math.min(rect.top, viewport.height - height - margin));
	return { top: Math.round(top), left: Math.round(Math.max(margin, left)) };
}

/** A hue (0–359) picked from a name: the same name always gets the same colour (avatars, profile banners). */
export function nameHue(name: string): number {
	let hash = 0;
	for (let at = 0; at < name.length; at += 1) hash = (hash * 31 + name.charCodeAt(at)) % 360;
	return hash;
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
				// The person rides in a class (the sanitizer drops `data-*`): the page opens their profile card on hover.
				const person = PERSON_ID.test(part.employeeId) ? ` chat-mention-person ${CHAT_PERSON_CLASS_PREFIX}${part.employeeId}` : '';
				return `<span class="chat-mention${part.isMe ? ' chat-mention-me' : ''}${person}">@${escapeHtml(part.label)}</span>`;
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

/** The Markdown marks the formatting bar puts around a selection (bold / italic, strike): a mention may sit inside them. */
const MARKDOWN_MARKS = '*_~';

/**
 * Where a mention's label ends: not before a letter or a digit (`@Bob Stone` is not in `@Bob Stoned`), nor before an
 * underscore that goes on into a word; an underscore that closes italics (`_@Bob Stone_`) still ends it.
 */
const MENTION_END = '(?![\\p{L}\\p{N}]|_[\\p{L}\\p{N}])';

/**
 * `@Name` back into `<@employeeId>` and `#channel` into `<#conversationId>` for the labels that were picked
 * (longest first, a label never matched inside a longer word), plus `@channel` / `@here` into `<!channel>` / `<!here>`.
 */
export function namesToTokens(text: string, people: ReadonlyMap<string, string>, channels: ReadonlyMap<string, string> = new Map()): string {
	let out = text;
	const byLength = (a: [string, string], b: [string, string]) => b[0].length - a[0].length;
	for (const [label, id] of [...people.entries()].sort(byLength)) {
		out = out.replace(new RegExp(`@${escapeRegExp(label)}${MENTION_END}`, 'gu'), `<@${id}>`);
	}
	for (const [label, id] of [...channels.entries()].sort(byLength)) {
		out = out.replace(new RegExp(`#${escapeRegExp(label)}${MENTION_END}`, 'gu'), `<#${id}>`);
	}
	return out.replace(new RegExp(`(^|[\\s${MARKDOWN_MARKS}])@(channel|here)(?=$|[\\s.,!?${MARKDOWN_MARKS}])`, 'gu'), '$1<!$2>');
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

/** The people whose name matches a query, best matches first (see `rankMentions`), a few at most. */
export function suggestMentions(people: readonly ChatPerson[], query: string, limit = 8): ChatPerson[] {
	return rankMentions(people, query, { limit }).map((suggestion) => suggestion.person);
}

/** Where a query matches a name: at its start (tier 0), at the start of a later word (1), inside a word (2), or not (-1). */
function matchAt(name: string, needle: string): { at: number; tier: number } {
	if (!needle) return { at: -1, tier: 0 };
	const lower = name.toLowerCase();
	if (lower.startsWith(needle)) return { at: 0, tier: 0 };
	const word = new RegExp(`[\\s\\-'.(]${escapeRegExp(needle)}`, 'u').exec(lower);
	if (word) return { at: word.index + 1, tier: 1 };
	const at = lower.indexOf(needle);
	return at < 0 ? { at: -1, tier: -1 } : { at, tier: 2 };
}

/** A name cut around the place a query matches it best (any case), so a suggestion list can bold the match. */
export function matchParts(name: string, query: string): { before: string; match: string; after: string } {
	const needle = query.trim().toLowerCase();
	const { at } = matchAt(name, needle);
	if (at < 0) return { before: name, match: '', after: '' };
	return { before: name.slice(0, at), match: name.slice(at, at + needle.length), after: name.slice(at + needle.length) };
}

/** One person the `@` list offers: the part of the name that matched, and how they relate to the conversation. */
export interface MentionSuggestion {
	person: ChatPerson;
	parts: ReturnType<typeof matchParts>;
	/** Whether they are in the conversation (null when its member list cannot tell). */
	member: boolean | null;
	isMe: boolean;
}

/**
 * The people an `@` query suggests, as a chat app ranks them: the name starting with the query first, then a later
 * word starting with it, then a match inside a word; at each level the conversation's known members first, then
 * the people its member list cannot tell about, then the ones known to be outside it; myself after the others of my
 * group; then by name.
 */
export function rankMentions(
	people: readonly ChatPerson[],
	query: string,
	options: { memberIds?: ChatMemberIds | null; meEmployeeId?: string | null; limit?: number } = {}
): MentionSuggestion[] {
	const needle = query.trim().toLowerCase();
	const { memberIds = null, meEmployeeId = null, limit = 8 } = options;
	const standing = (member: boolean | null) => (member === true ? 0 : member === null ? 1 : 2);
	return people
		.map((person) => ({ person, match: matchAt(person.name, needle) }))
		.filter(({ match }) => match.tier >= 0)
		.map(({ person, match }) => ({
			person,
			tier: match.tier,
			member: membershipOf(memberIds, person.employeeId),
			isMe: !!meEmployeeId && person.employeeId === meEmployeeId
		}))
		.sort(
			(a, b) =>
				a.tier - b.tier ||
				standing(a.member) - standing(b.member) ||
				Number(a.isMe) - Number(b.isMe) ||
				a.person.name.localeCompare(b.person.name)
		)
		.slice(0, limit)
		.map(({ person, member, isMe }) => ({ person, parts: matchParts(person.name, needle), member, isMe }));
}

/**
 * The text of the box cut into plain runs and mentions (`@Name`, `#channel`, `@channel`, `@here`), so a layer under
 * the box can tint each mention where it sits; a mention starts the text or follows a space, and no letter follows it.
 */
export function markMentions(text: string, labels: readonly string[]): { text: string; mention: boolean }[] {
	const tokens = [...new Set([...labels, '@channel', '@here'])].filter(Boolean).sort((a, b) => b.length - a.length);
	// The same edges as `namesToTokens`, so what is tinted is what goes out as a mention (inside Markdown marks too).
	const pattern = new RegExp(`(?<=^|[\\s${MARKDOWN_MARKS}])(?:${tokens.map(escapeRegExp).join('|')})${MENTION_END}`, 'gu');
	const parts: { text: string; mention: boolean }[] = [];
	let last = 0;
	for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
		if (match.index > last) parts.push({ text: text.slice(last, match.index), mention: false });
		parts.push({ text: match[0], mention: true });
		last = match.index + match[0].length;
	}
	if (last < text.length) parts.push({ text: text.slice(last), mention: false });
	return parts;
}

/**
 * The employees a conversation is known to hold, and whether that is all of them: a list entry may carry only a
 * summary of its members (fewer than its `memberCount`), so someone missing from it may still be a member.
 */
export interface ChatMemberIds {
	ids: ReadonlySet<string>;
	complete: boolean;
}

/** The employees of a conversation, or null when the conversation does not carry its members. */
export function memberEmployeeIds(conversation: Pick<IChatConversationWithState, 'members' | 'memberCount'> | null | undefined): ChatMemberIds | null {
	if (!conversation?.members) return null;
	const ids = new Set(conversation.members.map((member) => String(member.employeeId)));
	const count = conversation.memberCount;
	return { ids, complete: typeof count !== 'number' || ids.size >= count };
}

/** Whether someone is in a conversation: true or false when it is known, null when the member list cannot tell. */
export function membershipOf(memberIds: ChatMemberIds | null | undefined, employeeId: string): boolean | null {
	if (!memberIds) return null;
	if (memberIds.ids.has(employeeId)) return true;
	return memberIds.complete ? false : null;
}

/**
 * A person's own picture: none for an empty link or Gauzy's generic silhouette (`avatar-default.svg`, set on users
 * without a picture), so they show their initials as people without a picture do.
 */
export function ownPicture(url: string | null | undefined): string | null {
	const trimmed = url?.trim();
	if (!trimmed || /(^|\/)avatar-default\.svg([?#]|$)/i.test(trimmed)) return null;
	return trimmed;
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

/** How many people a direct or group conversation holds besides me. */
export function otherMemberCount(conversation: Pick<IChatConversationWithState, 'members'>, meEmployeeId: string | null): number {
	return (conversation.members ?? []).filter((member) => String(member.employeeId) !== String(meEmployeeId ?? '')).length;
}

/**
 * A group conversation's people besides me by first name ("Aster, Booster, Carter"): more of them fit a sidebar
 * row than with full names. Null when none of them is known (yet).
 */
export function groupShortTitle(
	conversation: Pick<IChatConversationWithState, 'members'>,
	people: ReadonlyMap<string, ChatPerson>,
	meEmployeeId: string | null
): string | null {
	const names = (conversation.members ?? [])
		.filter((member) => String(member.employeeId) !== String(meEmployeeId ?? ''))
		.map((member) => people.get(String(member.employeeId))?.name?.trim())
		.filter((name): name is string => !!name)
		.map((name) => name.split(/\s+/)[0]);
	return names.length ? names.join(', ') : null;
}

/**
 * The person a direct or group conversation's avatar shows: the first member who is not me, or me in a
 * conversation with myself. Null for a channel, or when the person is not known (yet).
 */
export function conversationPerson(
	conversation: Pick<IChatConversationWithState, 'kind' | 'members'>,
	people: ReadonlyMap<string, ChatPerson>,
	meEmployeeId: string | null
): ChatPerson | null {
	if (conversation.kind === ChatConversationKindEnum.CHANNEL) return null;
	const members = conversation.members ?? [];
	const other = members.find((member) => String(member.employeeId) !== String(meEmployeeId ?? '')) ?? members[0];
	return other ? (people.get(String(other.employeeId)) ?? null) : null;
}

/** Whether a body mentions me by name, or everyone (`@channel`, `@here`). */
export function mentionsMe(body: string, meEmployeeId: string | null): boolean {
	if (/<!(channel|here)>/.test(body)) return true;
	return !!meEmployeeId && mentionedEmployeeIds(body).includes(meEmployeeId);
}

/** Whether two instants fall on the same day of the local calendar. */
export function isSameDay(a: Date | string | number, b: Date | string | number): boolean {
	const first = new Date(a);
	const second = new Date(b);
	return first.getFullYear() === second.getFullYear() && first.getMonth() === second.getMonth() && first.getDate() === second.getDate();
}

/** Whether a conversation counts as unread for the list and the badges. */
export function isUnread(conversation: Pick<IChatConversationWithState, 'state'>): boolean {
	return (conversation.state?.unreadCount ?? 0) > 0 || (conversation.state?.mentionCount ?? 0) > 0;
}

/**
 * Whether anything was ever written in a conversation. A direct or group conversation exists from the moment it is
 * opened (from a person's page, the "New message" dialog), but the sidebar lists it only once it holds a message.
 * My read marker counts too: it moves as soon as my own first message is sent, before the list is read again.
 */
export function hasMessages(conversation: Pick<IChatConversationWithState, 'messageCount' | 'lastMessageAt' | 'state'>): boolean {
	return (conversation.messageCount ?? 0) > 0 || !!conversation.lastMessageAt || !!conversation.state?.lastReadMessageId;
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
