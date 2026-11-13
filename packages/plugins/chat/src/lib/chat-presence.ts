import { ChatPresenceStatus, REALTIME_PRESENCE_TTL_SECONDS } from '@gauzy/contracts';

/**
 * A person's presence from what their tabs last reported (`Employee.lastSeenAt`, `Employee.isIdle`, written by the
 * realtime channel's `POST /realtime/presence` or the employee's `PUT /employee/me/presence`): present while the last
 * report is within the window a connection counts without a new one, idle when that report said so.
 *
 * @param lastSeenAt When a tab last reported, if ever.
 * @param isIdle Whether that report said there was no input for a while.
 * @param now The server clock.
 */
export function chatPresenceOf(lastSeenAt: Date | string | null | undefined, isIdle: boolean | null | undefined, now: Date = new Date()): ChatPresenceStatus {
	const seen = lastSeenAt ? new Date(lastSeenAt).getTime() : NaN;
	if (!Number.isFinite(seen) || now.getTime() - seen > REALTIME_PRESENCE_TTL_SECONDS * 1000) return ChatPresenceStatus.OFFLINE;
	return isIdle ? ChatPresenceStatus.IDLE : ChatPresenceStatus.ACTIVE;
}
