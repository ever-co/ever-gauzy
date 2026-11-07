import { REALTIME_EVENT_NAMES, REALTIME_SIGNAL_EVENTS, REALTIME_STREAMED_EVENTS } from '@gauzy/contracts';

/** The REST prefix of the plugin's routes (`/api/realtime/...`). */
export const REALTIME_ROUTE_PREFIX = 'realtime';

/** The aggregate types the plugin stamps on the outbox rows it appends. */
export const REALTIME_AGGREGATES = {
	TASK: 'task',
	COMMENT: 'comment',
	MENTION: 'mention',
	EMPLOYEE_NOTIFICATION: 'employee_notification',
	DOCUMENT: 'document',
	EMPLOYEE: 'employee',
	CONVERSATION: 'conversation'
} as const;

/** How long two identical `*.updated` hints of one aggregate are folded into one. */
export const REALTIME_HINT_COALESCE_MS = 1000;

/** The most events one catch-up answer carries, and the default. */
export const REALTIME_CATCH_UP_MAX = 500;
export const REALTIME_CATCH_UP_DEFAULT = 200;

export { REALTIME_EVENT_NAMES, REALTIME_SIGNAL_EVENTS, REALTIME_STREAMED_EVENTS };
