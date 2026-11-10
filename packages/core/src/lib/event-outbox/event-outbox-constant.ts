/**
 * The dispatch pass's two names and its bounds.
 *
 * A scheduled job and the queue job it produces are different things and are named differently on
 * purpose: the first is what the scheduler fires, the second is what a worker consumes, and a
 * deployment that wants to watch the outbox drain in its queue dashboard needs the second name to be
 * the stable one. Both carry the kernel's own vocabulary rather than any domain's, because the rows
 * the pass drains belong to the platform and not to a resource.
 */

/** The schedule the dispatch pass is fired on. */
export const EVENT_OUTBOX_DISPATCH_SCHEDULE = 'event-outbox.dispatch.schedule';

/** The queue job the schedule produces and the worker consumes. */
export const EVENT_OUTBOX_DISPATCH_JOB = 'event-outbox.dispatch';

/** The queue the dispatch pass travels on. */
export const EVENT_OUTBOX_QUEUE_NAME = 'event-outbox-dispatch';

/**
 * How many outbox rows one pass claims.
 *
 * The claim is one row per partition — the head of each aggregate's queue — so this is a bound on
 * *aggregates* touched per pass rather than on events, and the events behind each head are drained by
 * the passes that follow. It is larger than the service's own default because a pass that runs every
 * minute has to absorb a burst rather than merely keep up with the average, and it is far below what
 * the lease below allows a pass to spend, because a pass that cannot finish inside its own lease is a
 * pass whose rows another dispatcher may reclaim while it is still working on them.
 */
export const EVENT_OUTBOX_DISPATCH_BATCH_SIZE = 100;

/**
 * How long a claimed row stays out of another pass's reach.
 *
 * Deliberately several times the schedule's own period rather than the service's one-minute default.
 * A consumer may do real work — an outbound HTTP call among it — so a pass can legitimately outlive
 * the minute that fired it, and a lease equal to the period would let the *next* pass reclaim rows
 * the current one is still handing to consumers. That is not a lost event, because the delivery
 * record refuses the second invocation, but it is two dispatchers spending their batches on each
 * other's rows and an attempt counter that climbs for no failure at all. Five minutes is still short
 * enough that a dispatcher which dies mid-pass has its rows picked up promptly, which is the only
 * thing the lease exists for.
 */
export const EVENT_OUTBOX_DISPATCH_LEASE_MS = 5 * 60 * 1000;

/**
 * The most passes one drain runs.
 *
 * A drain follows an append and keeps going while each pass publishes something, because a pass
 * claims the head of each aggregate's queue only. The bound keeps one request from holding a worker
 * for long: twenty-five passes of a hundred heads each is far beyond any burst a person produces, and
 * whatever is left is the next request's or the next tick's.
 */
export const EVENT_OUTBOX_DRAIN_MAX_PASSES = 25;

/**
 * How long an append-driven request waits before it asks for a pass.
 *
 * `append` runs inside the caller's transaction, so the row is not visible until that commits. The
 * wait lets the commit happen first and coalesces a burst of appends into one pass.
 */
export const EVENT_OUTBOX_APPEND_DEBOUNCE_MS = 75;

/**
 * When an append-driven request asks again, in case the first pass ran before the caller committed.
 *
 * Cheap — one claim that usually matches nothing — and it bounds the delay a slow commit can cause
 * to about a second instead of the next per-minute tick.
 */
export const EVENT_OUTBOX_APPEND_FOLLOW_UP_MS = 1_000;

/**
 * How often a process that drains the outbox in-process sweeps it without being asked.
 *
 * Only for a process without a queue, where nothing else drains: rows appended by another process,
 * rows whose retry came due and rows whose lease expired are picked up here.
 */
export const EVENT_OUTBOX_INLINE_SWEEP_MS = 15_000;
