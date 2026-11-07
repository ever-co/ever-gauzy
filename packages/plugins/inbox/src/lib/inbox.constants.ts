/** The inbox routes live under `/api/inbox` (plan 04 §3). */
export const INBOX_ROUTE_PREFIX = '/inbox';

/** A second mention of the same employee on the same record within this window is one entry, not two (spec FR-4). */
export const INBOX_MENTION_DEDUPE_WINDOW_MS = 10 * 60_000;
