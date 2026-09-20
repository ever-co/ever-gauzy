/**
 * The retention window's two names.
 *
 * A scheduled job and the queue job it produces are different things and are named differently on
 * purpose: the first is what the scheduler fires, the second is what a worker consumes, and a
 * deployment that wants to see the cleanup in its queue dashboard needs the second name to be the
 * stable one. Both carry the kernel's own vocabulary rather than any domain's, because the row they
 * sweep belongs to the platform and not to a resource.
 */

/** The schedule the cleanup is fired on. */
export const IDEMPOTENCY_CLEANUP_SCHEDULE = 'idempotency.cleanup.schedule';

/** The queue job the schedule produces and the worker consumes. */
export const IDEMPOTENCY_CLEANUP_JOB = 'idempotency.cleanup';

/** The queue the cleanup travels on. */
export const IDEMPOTENCY_QUEUE_NAME = 'idempotency-maintenance';

/**
 * How many rows one sweep deletes.
 *
 * Bounded because the first sweep of a long-lived installation can meet a table that grew for
 * months: an unbounded `DELETE` would hold locks for as long as it takes and, on the deployments
 * that run SQLite, block every writer behind it. A bounded sweep that runs hourly converges on the
 * same table and never asks the store for more than it can give back in one breath.
 */
export const IDEMPOTENCY_CLEANUP_BATCH_SIZE = 500;
