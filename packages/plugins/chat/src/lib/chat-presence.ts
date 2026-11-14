import { ChatPresenceStatus, REALTIME_PRESENCE_TTL_SECONDS } from '@gauzy/contracts';

/**
 * The realtime plugin's presence rows (`realtime_presence`), by entity name: the chat reads them when that plugin is
 * loaded, without depending on it.
 */
export const REALTIME_PRESENCE_ENTITY = 'RealtimePresence';
/** The key of the row that holds an employee's merged presence, `offline` included (`REALTIME_PUBLISHED_PRESENCE_KEY`). */
export const REALTIME_PUBLISHED_PRESENCE_KEY = '*';

/** How far apart the merge's row and the employee's `lastSeenAt` may be written in one report. */
const PUBLISHED_SLACK_MS = 5_000;

/** The merged presence the realtime channel last held for an employee. */
export interface ChatPublishedPresence {
	/** `active`, `idle`, `away` or `offline`. */
	status: string;
	/** When it was written. */
	at?: Date | string | null;
}

/** What a person's presence is read from: their employee row, and the realtime channel's merge where there is one. */
export interface ChatPresenceFacts {
	/** When a tab last reported (`POST /realtime/presence` or `PUT /employee/me/presence`), if ever. */
	lastSeenAt?: Date | string | null;
	/** Whether that report said there was no input for a while. */
	isIdle?: boolean | null;
	/** Whether they set themselves as away ("Set yourself as away" in the user menu). */
	isAway?: boolean | null;
	/** The realtime channel's merge of their tabs, when the realtime plugin is loaded and they reported through it. */
	published?: ChatPublishedPresence | null;
}

function timeOf(value: Date | string | null | undefined): number {
	return value ? new Date(value).getTime() : NaN;
}

/**
 * A person's presence. Offline when the realtime channel's merge says so: a last tab that closed reports `offline`, and
 * that report still moves `lastSeenAt`, so the window alone would keep them present for a while. A merge older than the
 * last report does not count (reports that came after it through the employee's own heartbeat, the channel since
 * turned off). Otherwise present while the last report is within the window a connection counts without a new one;
 * then idle when that report said so, or when they set themselves as away. Away by choice does not keep someone
 * present: with no tab open they are offline.
 *
 * @param facts The employee's presence columns, and the channel's merge.
 * @param now The server clock.
 */
export function chatPresenceOf({ lastSeenAt, isIdle, isAway, published }: ChatPresenceFacts, now: Date = new Date()): ChatPresenceStatus {
	const seen = timeOf(lastSeenAt);
	if (!Number.isFinite(seen) || now.getTime() - seen > REALTIME_PRESENCE_TTL_SECONDS * 1000) return ChatPresenceStatus.OFFLINE;
	if (published?.status === ChatPresenceStatus.OFFLINE) {
		const mergedAt = timeOf(published.at);
		if (!Number.isFinite(mergedAt) || seen <= mergedAt + PUBLISHED_SLACK_MS) return ChatPresenceStatus.OFFLINE;
	}
	return isIdle || isAway ? ChatPresenceStatus.IDLE : ChatPresenceStatus.ACTIVE;
}
