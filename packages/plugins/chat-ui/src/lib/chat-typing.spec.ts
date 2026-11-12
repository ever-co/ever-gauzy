import { CHAT_EVENT_NAMES } from '@gauzy/contracts';
import { afterHint, ChatTypingState, typingKey, typingLine, typingRefusalOf, typistsIn, withoutExpired, withTyping } from './chat-typing';
import type { ChatHint, ChatTypingSignal } from './services/chat-live';

const signal = (userId: string, expiresAt: number, place: { conversationId?: string; threadRootId?: string | null } = {}): ChatTypingSignal => ({
	conversationId: place.conversationId ?? 'c1',
	threadRootId: place.threadRootId ?? null,
	userId,
	employeeId: null,
	expiresAt
});

const hint = (name: ChatHint['name'], extra: Partial<ChatHint> = {}): ChatHint => ({
	eventId: 'e1',
	name,
	conversationId: 'c1',
	messageId: 'm1',
	threadRootId: null,
	change: null,
	...extra
});

describe('chat typing', () => {
	it('keeps the newest signal of each person and place', () => {
		let state: ChatTypingState = new Map();
		state = withTyping(state, signal('u1', 1_000));
		state = withTyping(state, signal('u1', 5_000));
		state = withTyping(state, signal('u1', 5_000, { threadRootId: 'r1' }));
		expect(state.size).toBe(2);
		expect(state.get(typingKey({ conversationId: 'c1', threadRootId: null, userId: 'u1' }))?.expiresAt).toBe(5_000);
	});

	it('drops the signals past their time, and keeps the same state when none is', () => {
		const state = withTyping(withTyping(new Map(), signal('u1', 1_000)), signal('u2', 9_000));
		expect([...withoutExpired(state, 2_000).values()].map((item) => item.userId)).toEqual(['u2']);
		const fresh = withTyping(new Map(), signal('u2', 9_000));
		expect(withoutExpired(fresh, 2_000)).toBe(fresh);
	});

	it("ends a person's typing where their message lands, and nowhere else", () => {
		const state = withTyping(withTyping(new Map(), signal('u1', 9_000)), signal('u1', 9_000, { threadRootId: 'r1' }));
		const after = afterHint(state, hint(CHAT_EVENT_NAMES.MESSAGE_CREATED, { authorUserId: 'u1', threadRootId: 'r1' }));
		expect([...after.values()].map((item) => item.threadRootId)).toEqual([null]);
		// Another event, or a message without its author, leaves the state as it was.
		expect(afterHint(state, hint(CHAT_EVENT_NAMES.MESSAGE_UPDATED, { authorUserId: 'u1' }))).toBe(state);
		expect(afterHint(state, hint(CHAT_EVENT_NAMES.MESSAGE_CREATED))).toBe(state);
	});

	it('lists the people typing in one place right now, never me, in their order of arrival', () => {
		let state: ChatTypingState = new Map();
		for (const item of [signal('u2', 9_000), signal('me', 9_000), signal('u3', 9_000), signal('u4', 1_000), signal('u5', 9_000, { threadRootId: 'r1' })]) {
			state = withTyping(state, item);
		}
		expect(typistsIn(state, { conversationId: 'c1', threadRootId: null }, 'me', 2_000)).toEqual(['u2', 'u3']);
		expect(typistsIn(state, { conversationId: 'c1', threadRootId: 'r1' }, 'me', 2_000)).toEqual(['u5']);
		expect(typistsIn(state, { conversationId: 'c2', threadRootId: null }, 'me', 2_000)).toEqual([]);
	});

	it('says who is typing in one line: one, two, or several people', () => {
		expect(typingLine([])).toBeNull();
		expect(typingLine(['Anna'])).toEqual({ key: 'CHAT.TYPING.ONE', params: { name: 'Anna' } });
		expect(typingLine(['Anna', 'Ben'])).toEqual({ key: 'CHAT.TYPING.TWO', params: { first: 'Anna', second: 'Ben' } });
		expect(typingLine(['Anna', 'Ben', 'Cleo'])).toEqual({ key: 'CHAT.TYPING.MANY', params: { count: '3' } });
	});

	it('tells a platform without the route from a place that refuses, and from a passing failure', () => {
		expect(typingRefusalOf({ status: 404, error: { message: 'Cannot POST /api/chat/conversations/c1/typing' } })).toBe('route');
		expect(typingRefusalOf({ status: 404, error: { message: 'The requested record was not found' } })).toBe('place');
		expect(typingRefusalOf({ status: 400, error: { message: 'This conversation is archived.' } })).toBe('place');
		expect(typingRefusalOf({ status: 403 })).toBe('place');
		expect(typingRefusalOf({ status: 429 })).toBeNull();
		expect(typingRefusalOf({ status: 0 })).toBeNull();
		expect(typingRefusalOf(null)).toBeNull();
	});
});
