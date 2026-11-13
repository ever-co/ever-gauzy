import { CHAT_EVENT_NAMES } from '@gauzy/contracts';
import type { ChatHint, ChatTypingSignal } from './services/chat-live';

/** Who is typing where: one entry per person and place (conversation and thread), the latest signal. */
export type ChatTypingState = ReadonlyMap<string, ChatTypingSignal>;

/** The key of a person typing in a place. */
export function typingKey(signal: Pick<ChatTypingSignal, 'conversationId' | 'threadRootId' | 'userId'>): string {
	return `${signal.conversationId}:${signal.threadRootId ?? ''}:${signal.userId}`;
}

/** The state after a signal: the person's entry for that place is the newest one. */
export function withTyping(state: ChatTypingState, signal: ChatTypingSignal): ChatTypingState {
	const next = new Map(state);
	next.set(typingKey(signal), signal);
	return next;
}

/** The state without the entries past their time (the same state when none is). */
export function withoutExpired(state: ChatTypingState, now: number): ChatTypingState {
	if (![...state.values()].some((signal) => signal.expiresAt <= now)) return state;
	return new Map([...state].filter(([, signal]) => signal.expiresAt > now));
}

/**
 * The state after a chat event: a new message ends its author's typing where it was written (its thread, or the
 * conversation for a message of the conversation itself).
 */
export function afterHint(state: ChatTypingState, hint: ChatHint): ChatTypingState {
	if (hint.name !== CHAT_EVENT_NAMES.MESSAGE_CREATED || !hint.authorUserId || !hint.conversationId) return state;
	const key = typingKey({ conversationId: hint.conversationId, threadRootId: hint.threadRootId ?? null, userId: hint.authorUserId });
	if (!state.has(key)) return state;
	const next = new Map(state);
	next.delete(key);
	return next;
}

/**
 * The people typing in one place right now, never me, by their order of arrival: their user ids (the page names
 * them).
 */
export function typistsIn(state: ChatTypingState, place: { conversationId: string; threadRootId: string | null }, meUserId: string | null, now: number): string[] {
	const typists: string[] = [];
	for (const signal of state.values()) {
		if (signal.expiresAt <= now) continue;
		if (signal.conversationId !== place.conversationId || (signal.threadRootId ?? null) !== (place.threadRootId ?? null)) continue;
		if (meUserId && signal.userId === meUserId) continue;
		if (!typists.includes(signal.userId)) typists.push(signal.userId);
	}
	return typists;
}

/** The line that says who is typing: its translation key and parameters, or null when nobody is. */
export function typingLine(names: readonly string[]): { key: string; params: Record<string, string> } | null {
	if (!names.length) return null;
	if (names.length === 1) return { key: 'CHAT.TYPING.ONE', params: { name: names[0] } };
	if (names.length === 2) return { key: 'CHAT.TYPING.TWO', params: { first: names[0], second: names[1] } };
	return { key: 'CHAT.TYPING.MANY', params: { count: String(names.length) } };
}

/**
 * What a refused typing signal means for the composer: `route` when the platform has no such route (a 404 of the
 * framework, "Cannot POST …"), `place` when this conversation or thread refuses it (not a member, archived, not found),
 * null when it may work next time (throttled, offline, a server error).
 */
export function typingRefusalOf(error: unknown): 'route' | 'place' | null {
	const failure = error as { status?: unknown; error?: { message?: unknown } | null } | null;
	const status = typeof failure?.status === 'number' ? failure.status : 0;
	const message = typeof failure?.error?.message === 'string' ? failure.error.message : '';
	if (status === 404 && /^Cannot (POST|GET|PUT|PATCH|DELETE) /.test(message)) return 'route';
	if (status === 400 || status === 403 || status === 404) return 'place';
	return null;
}
