import { CommerceCartStatus, CommerceCheckoutSessionStatus } from '@gauzy/contracts';

/**
 * The state filters the cart schema accepts, read into the enumerations the columns carry.
 *
 * A filter argument is declared as a `String` in the schema, so the value arrives as text and has to
 * be narrowed before it can stand as a predicate on an enumerated column. The narrowing is explicit
 * for that reason: an unknown value is refused rather than handed to the query, where it would match
 * nothing and read to the caller as an empty page rather than as a mistyped status.
 */
export const CART_STATUSES: readonly string[] = Object.values(CommerceCartStatus);
export const CHECKOUT_SESSION_STATUSES: readonly string[] = Object.values(CommerceCheckoutSessionStatus);

/**
 * @param value A cart status as the filter argument carried it.
 * @returns Whether it names one of the cart's states.
 */
export function isCartStatus(value: unknown): value is CommerceCartStatus {
	return typeof value === 'string' && CART_STATUSES.includes(value);
}

/**
 * @param value A checkout session status as the filter argument carried it.
 * @returns Whether it names one of the session's states.
 */
export function isCheckoutSessionStatus(value: unknown): value is CommerceCheckoutSessionStatus {
	return typeof value === 'string' && CHECKOUT_SESSION_STATUSES.includes(value);
}
