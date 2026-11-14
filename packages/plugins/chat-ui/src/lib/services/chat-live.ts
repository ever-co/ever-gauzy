import { asyncScheduler, BehaviorSubject, defer, merge, NEVER, Observable, of, OperatorFunction, SchedulerLike, Subject, Subscription, timer } from 'rxjs';
import { catchError, distinctUntilChanged, filter, finalize, ignoreElements, map, repeat, retry, share, switchMap, tap } from 'rxjs/operators';
import { CHAT_EVENT_NAMES, CHAT_STREAMED_EVENTS, CHAT_TYPING_TTL_MS, ChatEventName, IRealtimeEventEnvelope, IRealtimeStatus, REALTIME_EVENT_NAMES } from '@gauzy/contracts';
import { chatPresenceOf, ChatPresenceUpdate } from '../chat-presence';

/**
 * The chat families of the platform's collaboration events (`packages/plugins/realtime/README.md`): what the chat
 * plugin declares when it is loaded. One-segment patterns, as `Subscription.collaborationEvents` accepts them.
 */
export const CHAT_LIVE_SELECTION: readonly string[] = ['chat_message.*', 'chat_conversation.*', 'chat_member.*', 'chat_thread.*'];

/** The subscription the live channel opens: content-free hints, refetched through the REST routes. */
export const CHAT_EVENTS_SUBSCRIPTION = `subscription ChatCollaborationEvents($names: [String!]!, $aggregateId: ID) {
	collaborationEvents(names: $names, aggregateId: $aggregateId) {
		eventId
		eventName
		occurredAt
		aggregate { type id }
		sequence
		data
	}
}`;

/** Whether the conversation is followed live (events arrive promptly, the polls slow down) or by polling alone. */
export type ChatLiveMode = 'live' | 'fallback';

/** Where the tab's socket stands (`RealtimeSocketService.status$`). */
export type ChatSocketStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'stopped';

/**
 * One chat event, read as a hint: which conversation, message or thread changed. It carries no content and no
 * counters to apply; whoever shows the record refetches it.
 */
export interface ChatHint {
	eventId: string;
	name: ChatEventName;
	conversationId: string | null;
	/** The message that changed (a thread change names its root). */
	messageId: string | null;
	/** The thread the message belongs to, or the thread that changed. */
	threadRootId: string | null;
	/** What changed of a conversation (`created`, `updated`, `archived`, `members`, `removed`). */
	change: string | null;
	/** Who wrote the message (a new message ends its author's "is typing"). */
	authorUserId?: string | null;
}

/** Someone typing in a conversation (or one of its threads), until `expiresAt` (this tab's clock) unless told again. */
export interface ChatTypingSignal {
	conversationId: string;
	threadRootId: string | null;
	userId: string;
	employeeId: string | null;
	expiresAt: number;
}

/** The longest a typing signal is shown without being told again, whatever it asks. */
export const CHAT_TYPING_MAX_TTL_MS = 30_000;

/**
 * Reads one envelope as a typing signal (the realtime channel's `typing.signalled`), or null. The time it holds is
 * counted from its arrival on this tab's clock (never from the sender's), for what the signal asks (`expiresInMs`,
 * bounded) or the chat's own few seconds.
 */
export function chatTypingOf(envelope: Partial<IRealtimeEventEnvelope> | null | undefined, now: number = Date.now()): ChatTypingSignal | null {
	if (!envelope || envelope.eventName !== REALTIME_EVENT_NAMES.TYPING_SIGNALLED) return null;
	const raw = envelope.data;
	const data = raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
	const conversationId = idOf(data['conversationId']);
	const userId = idOf(data['userId']);
	if (!conversationId || !userId) return null;
	const asked = data['expiresInMs'];
	const ttl = typeof asked === 'number' && Number.isFinite(asked) && asked > 0 ? Math.min(asked, CHAT_TYPING_MAX_TTL_MS) : CHAT_TYPING_TTL_MS;
	return { conversationId, threadRootId: idOf(data['threadRootId']), userId, employeeId: idOf(data['employeeId']), expiresAt: now + ttl };
}

/** Whether the platform offers the typing signal on the subscription (its realtime status lists it). */
export function servesTyping(status: IRealtimeStatus | null | undefined): boolean {
	return (status?.signals ?? []).some((name) => name === REALTIME_EVENT_NAMES.TYPING_SIGNALLED);
}

/** Whether the platform offers the presence signal on the subscription (its realtime status lists it). */
export function servesPresence(status: IRealtimeStatus | null | undefined): boolean {
	return (status?.signals ?? []).some((name) => name === REALTIME_EVENT_NAMES.PRESENCE_CHANGED);
}

const CHAT_NAMES = new Set<string>(Object.values(CHAT_EVENT_NAMES));

function idOf(value: unknown): string | null {
	return typeof value === 'string' && value ? value : typeof value === 'number' ? String(value) : null;
}

/** Reads one envelope of the subscription as a chat hint, or null when it is not a chat event or names nothing. */
export function chatHintOf(envelope: Partial<IRealtimeEventEnvelope> | null | undefined): ChatHint | null {
	if (!envelope || typeof envelope.eventName !== 'string' || !CHAT_NAMES.has(envelope.eventName)) return null;
	const name = envelope.eventName as ChatEventName;
	const raw = envelope.data;
	const data = raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
	const aggregate = envelope.aggregate;
	const aggregateId = idOf(aggregate?.id);
	const isThread = name === CHAT_EVENT_NAMES.THREAD_CHANGED;
	const isMessage = name === CHAT_EVENT_NAMES.MESSAGE_CREATED || name === CHAT_EVENT_NAMES.MESSAGE_UPDATED || name === CHAT_EVENT_NAMES.MESSAGE_DELETED;
	const conversationId = idOf(data['conversationId']) ?? (aggregate?.type === 'chat_conversation' ? aggregateId : null);
	const threadRootId = isThread ? (idOf(data['rootMessageId']) ?? aggregateId) : idOf(data['threadRootId']);
	const messageId = isThread ? threadRootId : isMessage ? (idOf(data['messageId']) ?? aggregateId) : null;
	if (!conversationId && !messageId) return null;
	return {
		eventId: idOf(envelope.eventId) ?? '',
		name,
		conversationId,
		messageId,
		threadRootId,
		change: typeof data['change'] === 'string' ? (data['change'] as string) : null,
		authorUserId: idOf(data['authorUserId'])
	};
}

/** Whether the platform streams the chat events to this caller: the realtime channel is on and offers them. */
export function servesChatEvents(status: IRealtimeStatus | null | undefined): boolean {
	if (!status || status.subscriptions === false) return false;
	return (status.events ?? []).some((name) => typeof name === 'string' && name.startsWith('chat_message.'));
}

/**
 * Whether the platform offers every chat event the page follows (`CHAT_STREAMED_EVENTS`): with part of them only, the
 * others would wait for the safety poll, so the polls keep their pace (the offered ones still arrive as hints).
 */
export function coversChatEvents(status: IRealtimeStatus | null | undefined): boolean {
	const offered = new Set((status?.events ?? []).map(String));
	return CHAT_STREAMED_EVENTS.every((name) => offered.has(name));
}

/**
 * Whether an event reaches the socket right after its write (`delivery.prompt`): dispatched at once and handed to
 * the socket whichever API process holds it. Only then may a client slow its polls; an API older than the field
 * answers none, which counts as not prompt.
 */
export function deliversPromptly(status: IRealtimeStatus | null | undefined): boolean {
	return status?.delivery?.prompt === true;
}

/** What the live channel needs from the platform; the Angular service passes the socket and the HTTP client. */
export interface ChatLiveSource {
	/** The scope to follow (the signed-in user in the selected organization, where the chat is served), or null. */
	scope$: Observable<string | null>;
	/** `GET /api/realtime/status`: null when the platform has no realtime channel for the caller (404, 401, 403). */
	status(): Observable<IRealtimeStatus | null>;
	/** One GraphQL subscription over the tab's socket. */
	subscribe(query: string, variables: Record<string, unknown>): Observable<{ collaborationEvents?: Partial<IRealtimeEventEnvelope> | null } | null>;
	socketStatus$: Observable<ChatSocketStatus>;
}

export interface ChatLiveTiming {
	/** How long a subscription must run on a connected socket before the polls slow down (a refused field fails at once). */
	settleMs: number;
	/** The first wait before a failed subscription is opened again; it doubles up to `retryMaxMs`. */
	retryMinMs: number;
	retryMaxMs: number;
	/** The wait before a status request that failed for a passing reason is asked again, and how often. */
	statusRetryMs: number;
	statusRetries: number;
}

export const CHAT_LIVE_TIMING: ChatLiveTiming = {
	settleMs: 2_000,
	retryMinMs: 30_000,
	retryMaxMs: 10 * 60_000,
	statusRetryMs: 30_000,
	statusRetries: 3
};

/**
 * The live half of the chat: one subscription to the chat events for the tab, shared by every part of the page,
 * opened only where the platform streams them (`GAUZY_REALTIME_ENABLED=true`, the chat events declared).
 *
 * - `hints$` streams the events as {@link ChatHint}s; subscribing to it opens the subscription, the last
 *   listener to leave closes it.
 * - `mode$` says whether the parts may slow their polls: `live` once the subscription has run on a connected socket
 *   for a moment and the platform delivers promptly; `fallback` before that, while the socket reconnects, after the
 *   subscription failed (`RealtimeSocketUnavailableError`, a GraphQL error), and where there is no channel at all.
 *   Polling stays the fallback: the parts poll as before whenever the mode is `fallback`.
 * - `resumed$` emits each time the mode becomes `live` (the first time and after every reconnect): events written
 *   while the stream was down are not replayed, so whoever shows a record refetches it then.
 *
 * A failed subscription is opened again after a growing wait. A change of scope (another user or organization)
 * closes the subscription and asks the platform again.
 */
export class ChatLiveChannel {
	readonly hints$: Observable<ChatHint>;
	/** The typing signals of the members (where the platform offers them), on the same subscription. */
	readonly typing$: Observable<ChatTypingSignal>;
	/** The people's presence changes (where the platform offers them), on the same subscription. */
	readonly presence$: Observable<ChatPresenceUpdate>;
	/** The subscription's envelopes, shared by `hints$`, `typing$` and `presence$`. */
	private readonly envelopes$: Observable<Partial<IRealtimeEventEnvelope>>;

	private readonly modes = new BehaviorSubject<ChatLiveMode>('fallback');
	private readonly resumes = new Subject<void>();
	readonly mode$: Observable<ChatLiveMode> = this.modes.pipe(distinctUntilChanged());
	readonly resumed$: Observable<void> = this.resumes.asObservable();

	constructor(
		private readonly source: ChatLiveSource,
		private readonly timing: ChatLiveTiming = CHAT_LIVE_TIMING,
		private readonly scheduler: SchedulerLike = asyncScheduler
	) {
		this.envelopes$ = source.scope$.pipe(
			distinctUntilChanged(),
			switchMap((scope) => (scope ? this.follow() : this.idle())),
			share()
		);
		this.hints$ = this.envelopes$.pipe(
			map((envelope) => chatHintOf(envelope)),
			filter((hint): hint is ChatHint => hint !== null)
		);
		this.typing$ = this.envelopes$.pipe(
			map((envelope) => chatTypingOf(envelope)),
			filter((signal): signal is ChatTypingSignal => signal !== null)
		);
		this.presence$ = this.envelopes$.pipe(
			map((envelope) => chatPresenceOf(envelope)),
			filter((update): update is ChatPresenceUpdate => update !== null)
		);
	}

	/** The mode right now. */
	get mode(): ChatLiveMode {
		return this.modes.value;
	}

	private idle(): Observable<Partial<IRealtimeEventEnvelope>> {
		this.modes.next('fallback');
		return NEVER;
	}

	/** One scope: ask whether the chat events are streamed, then keep a subscription open while anyone listens. */
	private follow(): Observable<Partial<IRealtimeEventEnvelope>> {
		return defer(() => {
			const state = { prompt: false, connected: false, streaming: false };
			let settle: Subscription | null = null;
			const evaluate = () => {
				const ready = state.prompt && state.connected && state.streaming;
				if (!ready) {
					settle?.unsubscribe();
					settle = null;
					this.modes.next('fallback');
					return;
				}
				if (this.modes.value === 'live' || settle) return;
				settle = timer(this.timing.settleMs, this.scheduler).subscribe(() => {
					settle = null;
					if (!(state.prompt && state.connected && state.streaming)) return;
					this.modes.next('live');
					this.resumes.next();
				});
			};
			return this.status().pipe(
				switchMap((status) => {
					if (!servesChatEvents(status)) return NEVER;
					state.prompt = deliversPromptly(status) && coversChatEvents(status);
					const socket$ = this.source.socketStatus$.pipe(
						tap((status) => {
							state.connected = status === 'connected';
							evaluate();
						}),
						ignoreElements()
					);
					// The typing and presence signals ride on the same subscription, where the platform offers them.
					const names = [
						...CHAT_LIVE_SELECTION,
						...(servesTyping(status) ? [REALTIME_EVENT_NAMES.TYPING_SIGNALLED] : []),
						...(servesPresence(status) ? [REALTIME_EVENT_NAMES.PRESENCE_CHANGED] : [])
					];
					const stream$ = defer(() => this.source.subscribe(CHAT_EVENTS_SUBSCRIPTION, { names })).pipe(
						tap({
							subscribe: () => {
								state.streaming = true;
								evaluate();
							},
							finalize: () => {
								state.streaming = false;
								evaluate();
							}
						}),
						// A subscription the platform ended, or that failed, is opened again after a growing wait.
						repeat({ delay: () => timer(this.timing.retryMinMs, this.scheduler) }),
						retry({ delay: (_error: unknown, attempt: number) => timer(this.backoff(attempt), this.scheduler), resetOnSuccess: true }),
						map((data) => data?.collaborationEvents ?? null),
						filter((envelope): envelope is Partial<IRealtimeEventEnvelope> => !!envelope)
					);
					return merge(socket$, stream$);
				}),
				finalize(() => {
					settle?.unsubscribe();
					settle = null;
					this.modes.next('fallback');
				})
			);
		});
	}

	/** The platform's status, asked again a few times after a passing failure; null (no channel) after that. */
	private status(): Observable<IRealtimeStatus | null> {
		return defer(() => this.source.status()).pipe(
			retry({ count: this.timing.statusRetries, delay: () => timer(this.timing.statusRetryMs, this.scheduler) }),
			catchError(() => of(null))
		);
	}

	private backoff(attempt: number): number {
		return Math.min(this.timing.retryMaxMs, this.timing.retryMinMs * 2 ** Math.max(0, attempt - 1));
	}
}

/**
 * Runs a read for each trigger without ever cancelling one under way: a trigger that comes while a read runs asks for
 * one more read after it (however many came), so a steady stream of events cannot keep the reads from finishing.
 * Unsubscribing (a change of scope) cancels the read under way.
 */
export function coalesceReads<T>(read: () => Observable<T>): OperatorFunction<unknown, T> {
	return (source) =>
		new Observable<T>((subscriber) => {
			let running: Subscription | null = null;
			let again = false;
			let ended = false;
			const start = (): void => {
				again = false;
				let finished = false;
				const done = (): void => {
					finished = true;
					running = null;
					if (again) start();
					else if (ended) subscriber.complete();
				};
				const current = read().subscribe({ next: (value) => subscriber.next(value), error: done, complete: done });
				if (!finished) running = current;
			};
			const triggers = source.subscribe({
				next: () => {
					if (running) again = true;
					else start();
				},
				error: (error) => subscriber.error(error),
				complete: () => {
					ended = true;
					if (!running) subscriber.complete();
				}
			});
			return () => {
				triggers.unsubscribe();
				running?.unsubscribe();
			};
		});
}

/**
 * The ticks of a poll that follows the live mode: every `fallbackMs` while the mode is `fallback`, every `liveMs`
 * (a safety net for an event lost on the way) while it is `live`. A mode change starts the period again.
 */
export function pollTicks(mode$: Observable<ChatLiveMode>, fallbackMs: number, liveMs: number, scheduler: SchedulerLike = asyncScheduler): Observable<number> {
	return mode$.pipe(
		distinctUntilChanged(),
		switchMap((mode) => {
			const period = mode === 'live' ? Math.max(fallbackMs, liveMs) : fallbackMs;
			return timer(period, period, scheduler);
		})
	);
}

