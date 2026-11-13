import { ChatPresenceStatus, REALTIME_PRESENCE_TTL_SECONDS } from '@gauzy/contracts';

/** What a person's presence is read from: their employee row. */
export interface ChatPresenceFacts {
	/** When a tab last reported (`POST /realtime/presence` or `PUT /employee/me/presence`), if ever. */
	lastSeenAt?: Date | string | null;
	/** Whether that report said there was no input for a while. */
	isIdle?: boolean | null;
	/** Whether they set themselves as away ("Set yourself as away" in the user menu). */
	isAway?: boolean | null;
}

/**
 * A person's presence from their employee row: present while the last report is within the window a connection
 * counts without a new one; then idle when that report said so, or when they set themselves as away. Away by choice
 * does not keep someone present: with no tab open they are offline.
 *
 * @param facts The employee's presence columns.
 * @param now The server clock.
 */
export function chatPresenceOf({ lastSeenAt, isIdle, isAway }: ChatPresenceFacts, now: Date = new Date()): ChatPresenceStatus {
	const seen = lastSeenAt ? new Date(lastSeenAt).getTime() : NaN;
	if (!Number.isFinite(seen) || now.getTime() - seen > REALTIME_PRESENCE_TTL_SECONDS * 1000) return ChatPresenceStatus.OFFLINE;
	return isIdle || isAway ? ChatPresenceStatus.IDLE : ChatPresenceStatus.ACTIVE;
}
