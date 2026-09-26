/**
 * The retry pass's two names and its bounds.
 *
 * A scheduled job and the queue job it produces are different things and are named differently on
 * purpose: the first is what the scheduler fires, the second is what a worker consumes, and a
 * deployment that wants to watch its outbound deliveries drain in a queue dashboard needs the second
 * name to be the stable one.
 */

/** The schedule the retry pass is fired on. */
export const WEBHOOK_RETRY_SCHEDULE = 'webhook.retry.schedule';

/** The queue job the schedule produces and the worker consumes. */
export const WEBHOOK_RETRY_JOB = 'webhook.retry';

/** The queue the retry pass travels on. */
export const WEBHOOK_QUEUE_NAME = 'webhook-maintenance';

/**
 * How many due deliveries one pass attempts.
 *
 * The ladder's first rung is five seconds and its last is six hours, so a pass that runs every
 * minute meets a mixture of fresh failures and old ones. The bound is what keeps one endpoint's
 * outage — which can leave every delivery to it due at once — from turning a single pass into a
 * sweep over the whole table, and the attempts inside a pass are made one after another so a slow
 * endpoint costs its own timeout rather than the pool's.
 */
export const WEBHOOK_RETRY_BATCH_SIZE = 50;
