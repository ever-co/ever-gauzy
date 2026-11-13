import { IRealtimeEventEnvelope, REALTIME_EVENT_NAMES, RealtimePresenceStatus } from '@gauzy/contracts';

/** A person's presence as the chat draws it: a green, an amber or a grey dot. */
export type ChatPresence = 'online' | 'away' | 'offline';

/** What the chat knows of one person's presence. */
export interface ChatPresenceEntry {
	presence: ChatPresence;
	/** When they were last seen (epoch ms), when known. */
	lastSeenAt: number | null;
	/** The revision of the last `presence.changed` applied, when one was. */
	revision: number | null;
	/** When this tab learnt it (epoch ms, its own clock): a list read before that does not overwrite it. */
	learntAt: number;
}

/** One person's presence, as a list read or an event tells it. */
export interface ChatPresenceUpdate {
	employeeId: string;
	presence: ChatPresence;
	lastSeenAt: number | null;
	revision?: number | null;
}

/** How long without input before a shown tab reports itself idle. */
export const CHAT_PRESENCE_IDLE_AFTER_MS = 5 * 60_000;
/** How often a tab reports, changed or not (the platform forgets a connection after 150 s without a report). */
export const CHAT_PRESENCE_REPORT_MS = 60_000;
/** How often the people's presence is read again (only while the tab is shown, and something shows a person). */
export const CHAT_PRESENCE_POLL_MS = 60_000;

/** The presence a reported status (the chat's `active`/`idle`/`offline`, the channel's `away` too) is drawn as. */
export function presenceOfStatus(status: unknown): ChatPresence {
	switch (status) {
		case RealtimePresenceStatus.ACTIVE:
			return 'online';
		case RealtimePresenceStatus.IDLE:
		case RealtimePresenceStatus.AWAY:
			return 'away';
		default:
			return 'offline';
	}
}

function timeOf(value: unknown): number | null {
	if (value === null || value === undefined || value === '') return null;
	const time = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(String(value));
	return Number.isFinite(time) ? time : null;
}

/** Reads one envelope as a presence update (the realtime channel's `presence.changed`), or null. */
export function chatPresenceOf(envelope: Partial<IRealtimeEventEnvelope> | null | undefined, now: number = Date.now()): ChatPresenceUpdate | null {
	if (!envelope || envelope.eventName !== REALTIME_EVENT_NAMES.PRESENCE_CHANGED) return null;
	const raw = envelope.data;
	const data = raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
	const employeeId = typeof data['employeeId'] === 'string' || typeof data['employeeId'] === 'number' ? String(data['employeeId']) : null;
	if (!employeeId) return null;
	const presence = presenceOfStatus(data['status']);
	const revision = typeof data['revision'] === 'number' && Number.isFinite(data['revision']) ? (data['revision'] as number) : null;
	// Someone here is seen now. Someone gone keeps the last seen time already known: the event's `at` is when the change
	// was merged or told (up to the presence window after their last report), not when they were last here.
	const lastSeenAt = presence === 'offline' ? null : now;
	return { employeeId, presence, lastSeenAt, revision };
}

/** The presence a person of `GET /chat/people` was read with. */
export function presenceOfRecord(record: { employeeId?: unknown; presence?: unknown; lastSeenAt?: unknown } | null | undefined): ChatPresenceUpdate | null {
	if (!record?.employeeId) return null;
	return { employeeId: String(record.employeeId), presence: presenceOfStatus(record.presence), lastSeenAt: timeOf(record.lastSeenAt), revision: null };
}

/**
 * Applies an event to what the tab knows: only one newer than the last applied for the person (two API processes may
 * deliver two changes out of order). An event without a revision is applied as it comes.
 */
export function applyPresenceEvent(
	book: ReadonlyMap<string, ChatPresenceEntry>,
	update: ChatPresenceUpdate,
	now: number = Date.now()
): ReadonlyMap<string, ChatPresenceEntry> {
	const current = book.get(update.employeeId);
	const revision = update.revision ?? null;
	if (current && current.revision !== null && revision !== null && revision <= current.revision) return book;
	const next = new Map(book);
	next.set(update.employeeId, {
		presence: update.presence,
		lastSeenAt: update.lastSeenAt ?? current?.lastSeenAt ?? null,
		revision: revision ?? current?.revision ?? null,
		learntAt: now
	});
	return next;
}

/**
 * Applies a list read that started at `askedAt`: each person it names, unless the tab learnt of them after the read
 * started (an event that came while the list was on its way is newer than the list).
 */
export function applyPresenceList(
	book: ReadonlyMap<string, ChatPresenceEntry>,
	updates: readonly ChatPresenceUpdate[],
	askedAt: number,
	now: number = Date.now()
): ReadonlyMap<string, ChatPresenceEntry> {
	let next: Map<string, ChatPresenceEntry> | null = null;
	for (const update of updates) {
		const current = (next ?? book).get(update.employeeId);
		if (current && current.learntAt > askedAt) continue;
		if (current && current.presence === update.presence && current.lastSeenAt === update.lastSeenAt) continue;
		next ??= new Map(book);
		next.set(update.employeeId, {
			presence: update.presence,
			lastSeenAt: update.lastSeenAt,
			revision: current?.revision ?? null,
			learntAt: now
		});
	}
	return next ?? book;
}

/** How present each status is: the most present of a person's tabs is what they are. */
const PRESENCE_RANK: Record<string, number> = {
	[RealtimePresenceStatus.ACTIVE]: 3,
	[RealtimePresenceStatus.IDLE]: 2,
	[RealtimePresenceStatus.AWAY]: 1
};

/** The most present of some statuses (`offline` when there are none), as the realtime channel merges a person's tabs. */
export function mostPresent(statuses: readonly RealtimePresenceStatus[]): RealtimePresenceStatus {
	let best: RealtimePresenceStatus = RealtimePresenceStatus.OFFLINE;
	for (const status of statuses) if ((PRESENCE_RANK[status] ?? 0) > (PRESENCE_RANK[best] ?? 0)) best = status;
	return best;
}

/**
 * What a tab reports: `active` while shown with input lately, `idle` while shown without, `away` while hidden (the
 * person is in another window; another tab of theirs may still say more).
 */
export function tabStatus(visible: boolean, lastInputAt: number, now: number = Date.now(), idleAfterMs: number = CHAT_PRESENCE_IDLE_AFTER_MS): RealtimePresenceStatus {
	if (!visible) return RealtimePresenceStatus.AWAY;
	return now - lastInputAt >= idleAfterMs ? RealtimePresenceStatus.IDLE : RealtimePresenceStatus.ACTIVE;
}
