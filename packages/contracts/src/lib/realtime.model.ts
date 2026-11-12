import { ID, JsonData } from './base-entity.model';

/**
 * The real-time channel (`@gauzy/plugin-realtime`): the names of the collaboration events a client may
 * subscribe to, and the shapes they carry.
 *
 * Two kinds of event travel the channel:
 *
 * - **streamed** events are durable facts appended to the platform event outbox after a domain write
 *   (`<aggregate>.<action>`); they carry a sequence, can be replayed from `GET /api/realtime/events`, and
 *   reach webhooks like any other outbox event. Their payload is a **content-free change hint**: which
 *   record changed and how, never the record itself — a client refetches what it may read;
 * - **signal** events are ephemeral (presence, typing): published to subscribers only, never stored,
 *   lost on disconnect by design.
 */
export const REALTIME_EVENT_NAMES = {
	TASK_CREATED: 'task.created',
	TASK_UPDATED: 'task.updated',
	TASK_DELETED: 'task.deleted',
	COMMENT_CREATED: 'comment.created',
	COMMENT_UPDATED: 'comment.updated',
	COMMENT_DELETED: 'comment.deleted',
	MENTION_CREATED: 'mention.created',
	EMPLOYEE_NOTIFICATION_CREATED: 'employee_notification.created',
	DOCUMENT_UPDATED: 'document.updated',
	PRESENCE_CHANGED: 'presence.changed',
	TYPING_SIGNALLED: 'typing.signalled'
} as const;

export type RealtimeEventName = (typeof REALTIME_EVENT_NAMES)[keyof typeof REALTIME_EVENT_NAMES];

/** The durable events: appended to the outbox, replayable, selectable by `Subscription.collaborationEvents`. */
export const REALTIME_STREAMED_EVENTS: readonly RealtimeEventName[] = [
	REALTIME_EVENT_NAMES.TASK_CREATED,
	REALTIME_EVENT_NAMES.TASK_UPDATED,
	REALTIME_EVENT_NAMES.TASK_DELETED,
	REALTIME_EVENT_NAMES.COMMENT_CREATED,
	REALTIME_EVENT_NAMES.COMMENT_UPDATED,
	REALTIME_EVENT_NAMES.COMMENT_DELETED,
	REALTIME_EVENT_NAMES.MENTION_CREATED,
	REALTIME_EVENT_NAMES.EMPLOYEE_NOTIFICATION_CREATED,
	REALTIME_EVENT_NAMES.DOCUMENT_UPDATED
];

/** The ephemeral signals: published to subscribers, never stored. */
export const REALTIME_SIGNAL_EVENTS: readonly RealtimeEventName[] = [
	REALTIME_EVENT_NAMES.PRESENCE_CHANGED,
	REALTIME_EVENT_NAMES.TYPING_SIGNALLED
];

/** Everything a subscriber may select of the channel's own events. */
export const REALTIME_SUBSCRIBABLE_EVENTS: readonly RealtimeEventName[] = [
	...REALTIME_STREAMED_EVENTS,
	...REALTIME_SIGNAL_EVENTS
];

/**
 * The families (`<family>.<action>`) the collaboration channel carries: its own, and the ones the chat and
 * inbox plugins declare when they are loaded. `Subscription.collaborationEvents` and the catch-up offer the
 * declared names of these families and nothing else — the commerce streams, for one, stay out of reach of a
 * `REALTIME_SUBSCRIBE` holder. Every event of these families is scoped or addressed: the stream decides each
 * envelope against the subscriber's tenant, organization and user.
 */
export const REALTIME_COLLABORATION_FAMILIES: readonly string[] = [
	'task',
	'comment',
	'mention',
	'employee_notification',
	'document',
	'presence',
	'typing',
	'chat_message',
	'chat_conversation',
	// `chat_member.state_changed` (a member's read position and badges): the family is the part before the dot.
	'chat_member',
	'chat_thread',
	'inbox_item'
];

/** Whether an event name (`<family>.<action>`) belongs to one of the collaboration families. */
export function isCollaborationEventName(name: string): boolean {
	const dot = typeof name === 'string' ? name.indexOf('.') : -1;
	return dot > 0 && REALTIME_COLLABORATION_FAMILIES.includes(name.slice(0, dot));
}

/** What happened to the record a change hint names. */
export type RealtimeChangeAction = 'created' | 'updated' | 'deleted';

/**
 * A content-free change hint: the payload of every streamed event.
 *
 * A client that holds the hint knows **what** to refetch (`entity` + `entityId`, and the record it belongs
 * to when there is one) and nothing more; the record's own API decides what the caller may read.
 */
export interface IRealtimeChangeHint {
	/** The record kind, a `BaseEntityEnum` value where one exists (`Task`, `Comment`, `Document`, …). */
	entity: string;
	entityId: ID;
	action: RealtimeChangeAction;
	organizationId?: ID | null;
	/** The user whose request caused the change, when known. */
	actorUserId?: ID | null;
	/** The record this one belongs to (a comment's task, a mention's comment), for a client that lists by parent. */
	parent?: { entity: string; entityId: ID } | null;
	/** The project a task belongs to, so a board can refetch one column. */
	projectId?: ID | null;
	/**
	 * The users an **addressed** hint is for (a mention, a notification): only their subscriptions receive it.
	 * Absent on organization-wide hints.
	 */
	recipientUserIds?: ID[];
	/** Hint-specific members (`type` of a notification, `mentionedEmployeeId` of a mention). */
	[key: string]: unknown;
}

/** A client's presence as it reports it. */
export enum RealtimePresenceStatus {
	ACTIVE = 'active',
	IDLE = 'idle',
	AWAY = 'away',
	OFFLINE = 'offline'
}

/** Body of `POST /api/realtime/presence`. */
export interface IRealtimePresenceInput {
	/** What this connection reports; `offline` ends the connection (a closing tab). */
	status: RealtimePresenceStatus;
	/**
	 * The client's own id for this connection (one per tab or device, at most 64 letters, digits, `-` or `_`). Each
	 * connection reports for itself: the employee is as present as their most present connection (`active`, then
	 * `idle`, then `away`; `offline` when none is left), so closing one of two tabs leaves the other's state. A
	 * connection lapses when it has not reported for {@link REALTIME_PRESENCE_TTL_SECONDS}: report at least every
	 * minute, unchanged or not. Without it, every tab of the employee reports under one shared connection that never
	 * lapses, and the last report wins.
	 */
	connectionId?: string;
}

/** How long a named connection's presence counts without a new report from it. */
export const REALTIME_PRESENCE_TTL_SECONDS = 150;

/**
 * Payload of `presence.changed` and the answer of `POST /api/realtime/presence`: one employee's presence as the
 * platform now holds it — the merge of their connections. Told to the organization only when it changes, and at
 * most once per employee per 5 s: the changes of a window are told once, as its latest state, when it closes.
 */
export interface IRealtimePresence {
	employeeId: ID;
	userId: ID;
	organizationId?: ID | null;
	status: RealtimePresenceStatus;
	/**
	 * How many times this employee's presence changed: higher for every change, whichever API process tells it. Apply a
	 * `presence.changed` only when its revision is higher than the last one applied for the employee (two processes may
	 * deliver two changes out of order).
	 */
	revision?: number;
	/** ISO time the presence was merged (the route's answer) or told (the event: when its window opened). */
	at: string;
}

/** Body of `POST /api/realtime/typing`. */
export interface IRealtimeTypingInput {
	/** The conversation (or any record) the caller is typing in. */
	conversationId: ID;
	/** The thread root inside it, when typing in a thread. */
	threadRootId?: ID;
	/** The users to tell (the conversation's other members); at most {@link REALTIME_MAX_TYPING_RECIPIENTS}. */
	recipientUserIds: ID[];
}

/** The most recipients one typing signal may name. */
export const REALTIME_MAX_TYPING_RECIPIENTS = 50;

/** Payload of `typing.signalled`. */
export interface IRealtimeTypingSignal {
	conversationId: ID;
	threadRootId?: ID | null;
	employeeId?: ID | null;
	userId: ID;
	at: string;
	/**
	 * How long to show it, from `at`, unless the typist signals again (the chat's own typing route sets it; absent from
	 * a signal sent through `POST /realtime/typing`, for which a client keeps its own few seconds).
	 */
	expiresInMs?: number;
}

/** Query of `GET /api/realtime/events`. */
export interface IRealtimeCatchUpQuery {
	/**
	 * The `cursor` of the previous answer, in epoch milliseconds; omitted for a first call, which answers no event and
	 * the position to start from. With `afterId`, the cursor is exact: the events after that one. Without it, events
	 * at exactly that time are answered again (a client applies an event by its `eventId`, so a repeat is harmless).
	 */
	after?: number;
	/** The previous answer's `cursorId`, when it gave one. */
	afterId?: string;
	/** At most this many events (1–500, default 200). */
	limit?: number;
}

/** One event as a subscriber or a catch-up reader receives it (the kernel's `EventEnvelope`). */
export interface IRealtimeEventEnvelope<T = JsonData> {
	eventId: ID;
	eventName: string;
	occurredAt: Date | string;
	aggregate: { type: string; id: ID };
	/** Monotonic within the event's partition (its aggregate); `null` for a signal. */
	sequence: number | null;
	data: T;
}

/** Answer of `GET /api/realtime/events`. */
export interface IRealtimeCatchUp {
	events: IRealtimeEventEnvelope[];
	/**
	 * The position to continue from: the epoch ms to pass as `after` next time. `null` only when no outbox serves
	 * this process. It is a safe resume position: it never passes the platform's settle horizon (a few seconds
	 * behind now), so an event that commits after a later one was answered is still after it. **Resume from the
	 * cursor a catch-up answered, not from the newest event applied**: the events of an answer may run past its
	 * cursor (they are answered again from it — apply an event once, by its `eventId`), and a streamed event is no
	 * resume position at all (the stream delivers neither in commit order nor at once).
	 */
	cursor: number | null;
	/**
	 * The `eventId` to pass as `afterId` next time, beside `cursor`: the last row the answer walked past, which may be
	 * one not answered (addressed to someone else). `null` when the position is a time only (the settle horizon, or
	 * no cursor was sent): pass no `afterId` then.
	 */
	cursorId: string | null;
	/** True when more events follow the ones answered: call again with the cursor before trusting the stream. */
	hasMore: boolean;
	/**
	 * True when a retention removed events after `after` from what the caller reads: the client must refetch its
	 * data through the read APIs. Never answered while nothing was removed.
	 */
	resync: boolean;
}

/** Answer of `GET /api/realtime/status`. */
export interface IRealtimeStatus {
	enabled: true;
	/** Whether this process serves GraphQL subscriptions (a worker does not). */
	subscriptions: boolean;
	events: string[];
	signals: string[];
	maxTypingRecipients: number;
	/** How promptly events are pushed. Absent from an API older than this field: treat it as not prompt. */
	delivery?: IRealtimeDelivery;
}

/**
 * How promptly a written fact reaches an open subscription.
 */
export interface IRealtimeDelivery {
	/**
	 * Who hands an appended event to the subscriptions: this API process right after the append
	 * (`inline`), a queue job asked for right after the append (`queue`), or only a schedule (`none`).
	 */
	dispatch: 'inline' | 'queue' | 'none';
	/** Whether a published event reaches the sockets of every API process, not only one. */
	shared: boolean;
	/**
	 * Whether the installation runs one API process: on SQLite, or where the deployment declares it
	 * (`GAUZY_API_SINGLE_PROCESS=true`).
	 */
	singleProcess: boolean;
	/**
	 * True when a client may rely on pushed events instead of polling: the event is dispatched right
	 * after it is written, and reaches the socket whichever process dispatches it (the pub/sub is
	 * shared, or there is one API process). A client still catches up now and then, which bounds what
	 * a lost push can cost.
	 */
	prompt: boolean;
}
