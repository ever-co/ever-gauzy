/**
 * The names and bounds the cart's maintenance sweeps are registered and run under.
 *
 * They live in one file for the same reason the idempotency kernel's do: a scheduler registration, a
 * queue worker and the module that wires the two together each need the same three strings, and a
 * literal that drifts in one of them produces a job that is queued and never handled, with nothing
 * red anywhere.
 */

/** The queue both cart sweeps are dispatched through. */
export const CART_QUEUE_NAME = 'cart';

/** The scheduled job that asks for an expiry sweep. */
export const CART_EXPIRY_SCHEDULE = 'cart-expiry-sweep';

/** The queue job the expiry sweep is performed under. */
export const CART_EXPIRY_JOB = 'cart.expire-due';

/** The scheduled job that asks for an abandonment sweep. */
export const CART_ABANDON_SCHEDULE = 'cart-abandon-sweep';

/** The queue job the abandonment sweep is performed under. */
export const CART_ABANDON_JOB = 'cart.abandon-due';

/**
 * How many carts one sweep may move.
 *
 * The bound is the query's rather than the loop's, so a tenant with a large backlog is worked through
 * over several runs instead of in one pass that holds a pooled connection for the whole traversal.
 */
export const CART_SWEEP_BATCH_SIZE = 500;
