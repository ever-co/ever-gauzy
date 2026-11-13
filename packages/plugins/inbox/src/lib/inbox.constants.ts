/** The inbox routes live under `/api/inbox` (plan 04 §3). */
export const INBOX_ROUTE_PREFIX = '/inbox';

/** A second mention of the same employee on the same record within this window is one entry, not two (spec FR-4). */
export const INBOX_MENTION_DEDUPE_WINDOW_MS = 10 * 60_000;

/**
 * The recovery sweep of the notification filing (the Inbox spec §4 Reliability, "no lost entries"): the queue it is
 * asked on (the Inbox's maintenance queue), its job and schedule, and the named lock one sweep holds across the workers.
 */
export const INBOX_MAINTENANCE_QUEUE_NAME = 'inbox-maintenance';
export const INBOX_NOTIFICATION_SWEEP_JOB = 'inbox-notification-sweep';
export const INBOX_NOTIFICATION_SWEEP_SCHEDULE = 'inbox-notification-sweep';
export const INBOX_NOTIFICATION_SWEEP_LOCK = 'inbox-notification-sweep';
/** A sweep that could not run at all is tried again by the queue, a little later each time. */
export const INBOX_NOTIFICATION_SWEEP_ATTEMPTS = 3;
export const INBOX_NOTIFICATION_SWEEP_RETRY_DELAY_MS = 30_000;
/** The row of `inbox_sweep_checkpoint` the sweep keeps its place in. */
export const INBOX_NOTIFICATION_SWEEP_CHECKPOINT = 'notification-filing';
/** The notifications of the last minutes are the live filing's: the sweep reads only older ones. */
export const INBOX_NOTIFICATION_SWEEP_GRACE_MS = 5 * 60_000;
/** How many notifications one sweep reads, from its place on. */
export const INBOX_NOTIFICATION_SWEEP_BATCH = 500;
/**
 * A notification whose filing failed this many sweeps in a row is given up (logged as an error), so the ones after it
 * are not held back for ever; one the Inbox refuses (a `400`, such as an organization of another tenant) is given up
 * at once.
 */
export const INBOX_NOTIFICATION_SWEEP_MAX_ATTEMPTS = 5;
