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
