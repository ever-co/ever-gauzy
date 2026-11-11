import { REALTIME_EVENT_NAMES, REALTIME_PRESENCE_TTL_SECONDS, REALTIME_SIGNAL_EVENTS, REALTIME_STREAMED_EVENTS } from '@gauzy/contracts';

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

/**
 * How far behind now a catch-up cursor stays: longer than any transaction that appends to the outbox runs between
 * stamping its row (`createdAt`, the transaction's start on Postgres) and committing it, plus the clock difference
 * between the API processes and the database. A row stamped earlier than this has committed by now or never will.
 */
export const REALTIME_CATCH_UP_SETTLE_MS = 10_000;

/** The longest an open database transaction holds the catch-up cursor back (see `RealtimeSettleHorizon`). */
export const REALTIME_CATCH_UP_MAX_HOLD_MS = 5 * 60_000;

/** How long one read of the open transactions serves the catch-ups of a process (see `RealtimeSettleHorizon`). */
export const REALTIME_CATCH_UP_HORIZON_REUSE_MS = 1_000;

/** How long a connection's presence counts without a new report from it (clients report at least every minute). */
export const REALTIME_PRESENCE_TTL_MS = REALTIME_PRESENCE_TTL_SECONDS * 1000;

/** How often a process looks for presences whose connections lapsed, to tell the organization. */
export const REALTIME_PRESENCE_SWEEP_MS = 30_000;

/**
 * The replay window outbox retention keeps (spec FR-3): the collaboration events of the last 24 hours, and the newest
 * 1,000 of each scope (an organization, or the tenant-wide rows), whichever is larger.
 */
export const REALTIME_RETENTION_MIN_AGE_MS = 24 * 60 * 60_000;
export const REALTIME_RETENTION_MIN_EVENTS = 1_000;

/** How often a process with retention on prunes, and how much one pass removes at most. */
export const REALTIME_RETENTION_INTERVAL_MS = 60 * 60_000;
export const REALTIME_RETENTION_BATCH = 500;
export const REALTIME_RETENTION_SCOPES_PER_PASS = 50;

/**
 * The shortest time between two `presence.changed` of one employee, whichever process tells them (spec §4: at most
 * one message per employee per 5 s). Changes inside the window are told once, as the latest state, when it closes.
 */
export const REALTIME_PRESENCE_COALESCE_MS = 5_000;

export { REALTIME_EVENT_NAMES, REALTIME_SIGNAL_EVENTS, REALTIME_STREAMED_EVENTS };
