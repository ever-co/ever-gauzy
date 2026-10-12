import { isSchedulerQueueRootEnabled } from '@gauzy/scheduler';

export const WORKER_DEFAULT_QUEUE = process.env.WORKER_DEFAULT_QUEUE || 'worker-default';

/**
 * Whether this worker registers a BullMQ root (and therefore its own queues + `@Processor` hosts).
 *
 * Derived from `isSchedulerQueueRootEnabled()` — the ONE predicate every process that hosts
 * plugins evaluates — so the worker, the API and the Documents plugin's queue gate can never
 * disagree about whether a root exists. Behaviour is unchanged from the previous inline
 * `process.env.REDIS_ENABLED === 'true'`, except that `SCHEDULER_QUEUE_ENABLED=false` now turns
 * queueing off fleet-wide in one move.
 *
 * `WORKER_QUEUE_ENABLED=false` is kept as the pre-existing worker-local opt-out, and
 * `isSchedulerQueueRootEnabled()` reads it as well — so a plugin gate in this same process gets
 * the same answer instead of registering a `@Processor` against a root that was never created.
 * The `&&` below is therefore redundant today; it stays because this constant's contract is
 * "this variable can only ever narrow", and the helper could gain other inputs later.
 */
export const WORKER_QUEUE_ENABLED = process.env.WORKER_QUEUE_ENABLED !== 'false' && isSchedulerQueueRootEnabled();

export const WORKER_SCHEDULER_ENABLED = process.env.WORKER_SCHEDULER_ENABLED !== 'false';
