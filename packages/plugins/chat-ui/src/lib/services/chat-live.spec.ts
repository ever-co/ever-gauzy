import { BehaviorSubject, Observable, of, Subject, Subscription, throwError } from 'rxjs';
import { CHAT_STREAMED_EVENTS, IRealtimeEventEnvelope, IRealtimeStatus } from '@gauzy/contracts';
import { ChatPresenceUpdate } from '../chat-presence';
import {
	CHAT_EVENTS_SUBSCRIPTION,
	CHAT_LIVE_SELECTION,
	ChatHint,
	ChatLiveChannel,
	ChatLiveMode,
	ChatLiveTiming,
	ChatSocketStatus,
	ChatTypingSignal,
	CHAT_TYPING_MAX_TTL_MS,
	chatHintOf,
	chatTypingOf,
	coalesceReads,
	coversChatEvents,
	deliversPromptly,
	pollTicks,
	servesChatEvents,
	servesTyping
} from './chat-live';

const CONVERSATION = '11111111-1111-4111-8111-111111111111';
const MESSAGE = '22222222-2222-4222-8222-222222222222';
const ROOT = '33333333-3333-4333-8333-333333333333';

const DELIVERY = { dispatch: 'inline', shared: false, singleProcess: true, prompt: true } as const;

const STATUS: IRealtimeStatus = {
	enabled: true,
	subscriptions: true,
	events: ['task.created', ...CHAT_STREAMED_EVENTS],
	signals: ['typing.signalled'],
	maxTypingRecipients: 50,
	delivery: DELIVERY
};

const TIMING: ChatLiveTiming = { settleMs: 100, retryMinMs: 1_000, retryMaxMs: 4_000, statusRetryMs: 500, statusRetries: 2 };

function envelope(eventName: string, data: Record<string, unknown>, aggregate = { type: 'chat_message', id: MESSAGE }): Partial<IRealtimeEventEnvelope> {
	return { eventId: `e-${eventName}`, eventName, occurredAt: '2026-11-11T10:00:00.000Z', aggregate, sequence: 1, data: data as never };
}

/** A platform the channel talks to: the status it answers, the socket's state, and the subscriptions it opened. */
function platform(status: () => Observable<IRealtimeStatus | null> = () => of(STATUS)) {
	const scope$ = new BehaviorSubject<string | null>('user-1:org-1');
	const socketStatus$ = new BehaviorSubject<ChatSocketStatus>('connected');
	const streams: Subject<{ collaborationEvents: Partial<IRealtimeEventEnvelope> }>[] = [];
	const subscribe = jest.fn((...call: [string, Record<string, unknown>]) => {
		expect(call).toHaveLength(2);
		const stream = new Subject<{ collaborationEvents: Partial<IRealtimeEventEnvelope> }>();
		streams.push(stream);
		return stream.asObservable();
	});
	const statusCalls = jest.fn(status);
	const channel = new ChatLiveChannel({ scope$, status: statusCalls, subscribe, socketStatus$ }, TIMING);
	const modes: ChatLiveMode[] = [];
	const resumed: number[] = [];
	const watching = new Subscription();
	watching.add(channel.mode$.subscribe((mode) => modes.push(mode)));
	watching.add(channel.resumed$.subscribe(() => resumed.push(Date.now())));
	return { channel, scope$, socketStatus$, streams, subscribe, statusCalls, modes, resumed, watching };
}

describe('chatTypingOf', () => {
	it('reads a typing signal: its place and person, held for what it asks from its arrival', () => {
		const signal = chatTypingOf(envelope('typing.signalled', { conversationId: CONVERSATION, threadRootId: ROOT, userId: 'u-anna', employeeId: 'e-anna', expiresInMs: 6000 }), 1_000);
		expect(signal).toEqual({ conversationId: CONVERSATION, threadRootId: ROOT, userId: 'u-anna', employeeId: 'e-anna', expiresAt: 7_000 });
	});

	it('bounds what a signal asks, and takes the chat default when it asks nothing usable', () => {
		const long = chatTypingOf(envelope('typing.signalled', { conversationId: CONVERSATION, userId: 'u-anna', expiresInMs: 600_000 }), 0);
		expect(long?.expiresAt).toBe(CHAT_TYPING_MAX_TTL_MS);
		const none = chatTypingOf(envelope('typing.signalled', { conversationId: CONVERSATION, userId: 'u-anna', expiresInMs: -5 }), 0);
		expect(none?.expiresAt).toBeGreaterThan(0);
		expect(none?.expiresAt).toBeLessThanOrEqual(CHAT_TYPING_MAX_TTL_MS);
	});

	it('reads nothing from another event or a signal without its place or person', () => {
		expect(chatTypingOf(envelope('chat_message.created', { conversationId: CONVERSATION, userId: 'u-anna' }))).toBeNull();
		expect(chatTypingOf(envelope('typing.signalled', { userId: 'u-anna' }))).toBeNull();
		expect(chatTypingOf(envelope('typing.signalled', { conversationId: CONVERSATION }))).toBeNull();
		expect(chatTypingOf(null)).toBeNull();
	});

	it('knows whether the platform offers the signal', () => {
		expect(servesTyping(STATUS)).toBe(true);
		expect(servesTyping({ ...STATUS, signals: [] })).toBe(false);
		expect(servesTyping(null)).toBe(false);
	});
});

describe('chatHintOf', () => {
	it('reads a message event: its conversation, message, thread and author', () => {
		expect(
			chatHintOf(envelope('chat_message.created', { conversationId: CONVERSATION, messageId: MESSAGE, threadRootId: ROOT, kind: 'message', authorUserId: 'u-anna' }))
		).toEqual({
			eventId: 'e-chat_message.created',
			name: 'chat_message.created',
			conversationId: CONVERSATION,
			messageId: MESSAGE,
			threadRootId: ROOT,
			change: null,
			authorUserId: 'u-anna'
		});
		expect(chatHintOf(envelope('chat_message.created', { conversationId: CONVERSATION, messageId: MESSAGE }))?.authorUserId).toBeNull();
	});

	it('reads a thread change as a change of its root message', () => {
		const hint = chatHintOf(envelope('chat_thread.changed', { rootMessageId: ROOT, conversationId: CONVERSATION, replyCount: 3 }, { type: 'chat_thread', id: ROOT }));
		expect(hint).toMatchObject({ name: 'chat_thread.changed', conversationId: CONVERSATION, messageId: ROOT, threadRootId: ROOT });
	});

	it('reads a conversation change with what changed, and a member state with its conversation', () => {
		expect(chatHintOf(envelope('chat_conversation.changed', { conversationId: CONVERSATION, change: 'archived' }, { type: 'chat_conversation', id: CONVERSATION }))).toMatchObject({
			conversationId: CONVERSATION,
			messageId: null,
			change: 'archived'
		});
		// A member state names its conversation by the aggregate when the data leaves it out.
		expect(chatHintOf(envelope('chat_member.state_changed', { readCount: 4 }, { type: 'chat_conversation', id: CONVERSATION }))).toMatchObject({
			name: 'chat_member.state_changed',
			conversationId: CONVERSATION
		});
	});

	it('reads nothing of another family, of a malformed envelope, or of an event that names nothing', () => {
		expect(chatHintOf(envelope('task.updated', { entityId: 't1' }))).toBeNull();
		expect(chatHintOf(null)).toBeNull();
		expect(chatHintOf({ eventName: 'chat_message.created' } as Partial<IRealtimeEventEnvelope>)).toBeNull();
		expect(chatHintOf(envelope('chat_conversation.changed', { change: 'updated' }, { type: 'chat_category', id: 'x' }))).toBeNull();
	});
});

describe('servesChatEvents / deliversPromptly', () => {
	it('needs a process that serves subscriptions and offers the chat events', () => {
		expect(servesChatEvents(STATUS)).toBe(true);
		expect(servesChatEvents({ ...STATUS, subscriptions: false })).toBe(false);
		expect(servesChatEvents({ ...STATUS, events: ['task.created'] })).toBe(false);
		expect(servesChatEvents(null)).toBe(false);
	});

	it('needs every chat event the page follows before the polls may slow down', () => {
		expect(coversChatEvents(STATUS)).toBe(true);
		expect(coversChatEvents({ ...STATUS, events: ['chat_message.created', 'chat_message.updated'] })).toBe(false);
		expect(coversChatEvents(null)).toBe(false);
	});

	it('counts only an explicit prompt delivery (an older API answers none)', () => {
		expect(deliversPromptly(STATUS)).toBe(true);
		expect(deliversPromptly({ ...STATUS, delivery: { ...DELIVERY, prompt: false } })).toBe(false);
		expect(deliversPromptly({ ...STATUS, delivery: undefined })).toBe(false);
	});
});

describe('ChatLiveChannel', () => {
	beforeEach(() => jest.useFakeTimers());
	afterEach(() => jest.useRealTimers());

	it('opens one subscription to the chat families for every listener, and streams its events as hints', () => {
		const { channel, subscribe, streams, watching } = platform();
		const first: ChatHint[] = [];
		const second: ChatHint[] = [];
		watching.add(channel.hints$.subscribe((hint) => first.push(hint)));
		watching.add(channel.hints$.subscribe((hint) => second.push(hint)));

		expect(subscribe).toHaveBeenCalledTimes(1);
		// The platform offers the typing signal: it rides on the same subscription.
		expect(subscribe).toHaveBeenCalledWith(CHAT_EVENTS_SUBSCRIPTION, { names: [...CHAT_LIVE_SELECTION, 'typing.signalled'] });
		streams[0].next({ collaborationEvents: envelope('chat_message.updated', { conversationId: CONVERSATION, messageId: MESSAGE }) });
		streams[0].next({ collaborationEvents: envelope('presence.changed', { employeeId: 'x' }) });
		expect(first.map((hint) => hint.name)).toEqual(['chat_message.updated']);
		expect(second).toEqual(first);
		watching.unsubscribe();
	});

	it('streams the typing signals beside the hints, on the one subscription', () => {
		const { channel, subscribe, streams, watching } = platform();
		const hints: ChatHint[] = [];
		const typing: ChatTypingSignal[] = [];
		watching.add(channel.hints$.subscribe((hint) => hints.push(hint)));
		watching.add(channel.typing$.subscribe((signal) => typing.push(signal)));
		expect(subscribe).toHaveBeenCalledTimes(1);
		streams[0].next({ collaborationEvents: envelope('typing.signalled', { conversationId: CONVERSATION, userId: 'u-anna', employeeId: 'e-anna', expiresInMs: 6000 }) });
		streams[0].next({ collaborationEvents: envelope('chat_message.created', { conversationId: CONVERSATION, messageId: MESSAGE }) });
		expect(typing.map((signal) => signal.userId)).toEqual(['u-anna']);
		expect(hints.map((hint) => hint.name)).toEqual(['chat_message.created']);
		watching.unsubscribe();
	});

	it('streams the presence changes on the one subscription, where the platform offers them', () => {
		const { channel, subscribe, streams, watching } = platform(() => of({ ...STATUS, signals: ['typing.signalled', 'presence.changed'] }));
		const presence: ChatPresenceUpdate[] = [];
		watching.add(channel.presence$.subscribe((update) => presence.push(update)));
		expect(subscribe).toHaveBeenCalledWith(CHAT_EVENTS_SUBSCRIPTION, { names: [...CHAT_LIVE_SELECTION, 'typing.signalled', 'presence.changed'] });
		streams[0].next({ collaborationEvents: envelope('presence.changed', { employeeId: 'e-anna', userId: 'u-anna', status: 'idle', revision: 4 }) });
		streams[0].next({ collaborationEvents: envelope('chat_message.created', { conversationId: CONVERSATION, messageId: MESSAGE }) });
		expect(presence.map(({ employeeId, presence, revision }) => ({ employeeId, presence, revision }))).toEqual([
			{ employeeId: 'e-anna', presence: 'away', revision: 4 }
		]);
		watching.unsubscribe();
	});

	it('does not ask for the typing signal where the platform does not offer it', () => {
		const { channel, subscribe, watching } = platform(() => of({ ...STATUS, signals: [] }));
		watching.add(channel.hints$.subscribe());
		expect(subscribe).toHaveBeenCalledWith(CHAT_EVENTS_SUBSCRIPTION, { names: [...CHAT_LIVE_SELECTION] });
		watching.unsubscribe();
	});

	it('goes live once the subscription ran on a connected socket for a moment, and asks for a catch-up then', () => {
		const { channel, modes, resumed, watching } = platform();
		watching.add(channel.hints$.subscribe());
		expect(channel.mode).toBe('fallback');

		jest.advanceTimersByTime(TIMING.settleMs - 1);
		expect(channel.mode).toBe('fallback');
		jest.advanceTimersByTime(1);
		expect(channel.mode).toBe('live');
		expect(modes).toEqual(['fallback', 'live']);
		expect(resumed).toHaveLength(1);
		watching.unsubscribe();
	});

	it('falls back while the socket reconnects, and goes live again with a new catch-up when it is back', () => {
		const { channel, socketStatus$, resumed, watching } = platform();
		watching.add(channel.hints$.subscribe());
		jest.advanceTimersByTime(TIMING.settleMs);
		expect(channel.mode).toBe('live');

		socketStatus$.next('reconnecting');
		expect(channel.mode).toBe('fallback');
		socketStatus$.next('connected');
		jest.advanceTimersByTime(TIMING.settleMs);
		expect(channel.mode).toBe('live');
		expect(resumed).toHaveLength(2);
		watching.unsubscribe();
	});

	it('keeps polling where delivery is not prompt, while the hints still arrive', () => {
		const { channel, streams, watching } = platform(() => of({ ...STATUS, delivery: { ...DELIVERY, prompt: false } }));
		const hints: ChatHint[] = [];
		watching.add(channel.hints$.subscribe((hint) => hints.push(hint)));
		jest.advanceTimersByTime(TIMING.settleMs * 10);
		expect(channel.mode).toBe('fallback');
		streams[0].next({ collaborationEvents: envelope('chat_message.created', { conversationId: CONVERSATION, messageId: MESSAGE }) });
		expect(hints).toHaveLength(1);
		watching.unsubscribe();
	});

	it('keeps polling where the platform offers part of the chat events, while those arrive as hints', () => {
		const { channel, streams, watching } = platform(() => of({ ...STATUS, events: ['chat_message.created', 'chat_message.updated'] }));
		const hints: ChatHint[] = [];
		watching.add(channel.hints$.subscribe((hint) => hints.push(hint)));
		jest.advanceTimersByTime(TIMING.settleMs * 10);
		expect(channel.mode).toBe('fallback');
		streams[0].next({ collaborationEvents: envelope('chat_message.created', { conversationId: CONVERSATION, messageId: MESSAGE }) });
		expect(hints).toHaveLength(1);
		watching.unsubscribe();
	});

	it('opens no subscription where the platform does not stream the chat events', () => {
		for (const status of [null, { ...STATUS, events: ['task.created'] }]) {
			const { channel, subscribe, watching } = platform(() => of(status));
			watching.add(channel.hints$.subscribe());
			jest.advanceTimersByTime(60_000);
			expect(subscribe).not.toHaveBeenCalled();
			expect(channel.mode).toBe('fallback');
			watching.unsubscribe();
		}
	});

	it('asks for the status again after a passing failure, and gives up quietly after a few', () => {
		let calls = 0;
		const { channel, subscribe, statusCalls, watching } = platform(() => (++calls < 3 ? throwError(() => new Error('502')) : of(STATUS)));
		watching.add(channel.hints$.subscribe());
		expect(subscribe).not.toHaveBeenCalled();
		jest.advanceTimersByTime(TIMING.statusRetryMs * 2);
		expect(statusCalls).toHaveBeenCalledTimes(3);
		expect(subscribe).toHaveBeenCalledTimes(1);
		watching.unsubscribe();

		const failing = platform(() => throwError(() => new Error('502')));
		failing.watching.add(failing.channel.hints$.subscribe());
		jest.advanceTimersByTime(TIMING.statusRetryMs * 10);
		expect(failing.statusCalls).toHaveBeenCalledTimes(TIMING.statusRetries + 1);
		expect(failing.subscribe).not.toHaveBeenCalled();
		failing.watching.unsubscribe();
	});

	it('falls back when the subscription fails, and opens it again after a growing wait', () => {
		const { channel, streams, subscribe, watching } = platform();
		watching.add(channel.hints$.subscribe());
		jest.advanceTimersByTime(TIMING.settleMs);
		expect(channel.mode).toBe('live');

		streams[0].error(Object.assign(new Error('The server refused the socket: 4403'), { name: 'RealtimeSocketUnavailableError' }));
		expect(channel.mode).toBe('fallback');
		jest.advanceTimersByTime(TIMING.retryMinMs - 1);
		expect(subscribe).toHaveBeenCalledTimes(1);
		jest.advanceTimersByTime(1);
		expect(subscribe).toHaveBeenCalledTimes(2);

		streams[1].error(new Error('Cannot query field "collaborationEvents"'));
		jest.advanceTimersByTime(TIMING.retryMinMs);
		expect(subscribe).toHaveBeenCalledTimes(2);
		jest.advanceTimersByTime(TIMING.retryMinMs);
		expect(subscribe).toHaveBeenCalledTimes(3);
		jest.advanceTimersByTime(TIMING.settleMs);
		expect(channel.mode).toBe('live');
		watching.unsubscribe();
	});

	it('closes the subscription with its last listener, and asks again for another scope', () => {
		const { channel, streams, scope$, statusCalls, subscribe, watching } = platform();
		const listener = channel.hints$.subscribe();
		jest.advanceTimersByTime(TIMING.settleMs);
		expect(streams[0].observed).toBe(true);

		scope$.next('user-1:org-2');
		expect(streams[0].observed).toBe(false);
		expect(statusCalls).toHaveBeenCalledTimes(2);
		expect(subscribe).toHaveBeenCalledTimes(2);

		scope$.next(null);
		expect(streams[1].observed).toBe(false);
		expect(channel.mode).toBe('fallback');

		scope$.next('user-1:org-2');
		listener.unsubscribe();
		expect(streams[2].observed).toBe(false);
		expect(channel.mode).toBe('fallback');
		watching.unsubscribe();
	});
});

describe('coalesceReads', () => {
	it('lets a read under way finish, and runs one more read for every trigger that came meanwhile', () => {
		const triggers = new Subject<void>();
		const reads: Subject<number>[] = [];
		const answers: number[] = [];
		const subscription = triggers
			.pipe(
				coalesceReads(() => {
					const read = new Subject<number>();
					reads.push(read);
					return read;
				})
			)
			.subscribe((answer) => answers.push(answer));

		triggers.next();
		triggers.next();
		triggers.next();
		expect(reads).toHaveLength(1);
		reads[0].next(1);
		reads[0].complete();
		// The three triggers asked for one read after the first.
		expect(reads).toHaveLength(2);
		reads[1].next(2);
		reads[1].complete();
		expect(reads).toHaveLength(2);
		expect(answers).toEqual([1, 2]);

		// A failed read does not stop the next triggers.
		triggers.next();
		reads[2].error(new Error('500'));
		triggers.next();
		expect(reads).toHaveLength(4);
		subscription.unsubscribe();
		expect(reads[3].observed).toBe(false);
	});

	it('runs a read that answers at once for each trigger', () => {
		const triggers = new Subject<void>();
		const answers: number[] = [];
		let count = 0;
		const subscription = triggers.pipe(coalesceReads(() => of((count += 1)))).subscribe((answer) => answers.push(answer));
		triggers.next();
		triggers.next();
		expect(answers).toEqual([1, 2]);
		subscription.unsubscribe();
	});
});

describe('pollTicks', () => {
	beforeEach(() => jest.useFakeTimers());
	afterEach(() => jest.useRealTimers());

	it('ticks at the fallback period, at the live one while live, and starts the period again on a change', () => {
		const mode$ = new BehaviorSubject<ChatLiveMode>('fallback');
		const ticks: number[] = [];
		const subscription = pollTicks(mode$, 5_000, 60_000).subscribe(() => ticks.push(Date.now()));
		jest.advanceTimersByTime(15_000);
		expect(ticks).toHaveLength(3);

		mode$.next('live');
		jest.advanceTimersByTime(59_999);
		expect(ticks).toHaveLength(3);
		jest.advanceTimersByTime(1);
		expect(ticks).toHaveLength(4);

		mode$.next('fallback');
		jest.advanceTimersByTime(5_000);
		expect(ticks).toHaveLength(5);
		subscription.unsubscribe();
	});

	it('never polls faster while live than without the channel', () => {
		const ticks: number[] = [];
		const subscription = pollTicks(new BehaviorSubject<ChatLiveMode>('live'), 120_000, 60_000).subscribe(() => ticks.push(1));
		jest.advanceTimersByTime(119_999);
		expect(ticks).toHaveLength(0);
		jest.advanceTimersByTime(1);
		expect(ticks).toHaveLength(1);
		subscription.unsubscribe();
	});
});
