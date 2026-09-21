/**
 * The expiry sweep's two names and its bounds.
 *
 * A scheduled job and the queue job it produces are different things and are named differently on
 * purpose: the first is what the scheduler fires, the second is what a worker consumes, and a
 * deployment that wants to watch holds being released in its queue dashboard needs the second name
 * to be the stable one. Both are namespaced to this package, because the rows they sweep belong to
 * the inventory domain and not to the platform.
 */

/** The schedule the expiry sweep is fired on. */
export const STOCK_RESERVATION_EXPIRY_SCHEDULE = 'inventory.stock-reservation.expiry.schedule';

/** The queue job the schedule produces and the worker consumes. */
export const STOCK_RESERVATION_EXPIRY_JOB = 'inventory.stock-reservation.expiry';

/** The queue the expiry sweep travels on. */
export const STOCK_RESERVATION_QUEUE_NAME = 'inventory-stock-reservation-maintenance';

/**
 * How many expired holds one pass claims.
 *
 * It is the service's own documented batch, restated here because the worker is what states it to
 * the service and a deployment reads the bound from the job rather than from a default argument. A
 * pass is bounded for the same reason every other maintenance pass on this platform is: the first
 * sweep of an installation that has never run one can meet months of abandoned carts, and an
 * unbounded walk would hold the level rows of the whole catalogue for as long as it takes — on the
 * deployments that run SQLite, blocking every writer behind it.
 */
export const STOCK_RESERVATION_EXPIRY_BATCH_SIZE = 500;

/**
 * How many batches one pass walks at most.
 *
 * The sweep runs every minute, so a backlog is drained over several passes rather than in one long
 * transaction, and a pass that stops short leaves exactly the rows the next one reads first — the
 * selection is ordered by expiry, so the oldest hold is always the next one released.
 */
export const STOCK_RESERVATION_EXPIRY_MAX_BATCHES = 20;
