import { CommerceCartStatus, CommerceCheckoutSessionStatus } from '@gauzy/contracts';
import { ApiErrorCode, ApiException } from '@gauzy/core';

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

/** The length of `commerce_checkout_session.step`, which the REST body states as `@MaxLength(64)`. */
export const CHECKOUT_STEP_MAX_LENGTH = 64;

/**
 * Refuses a checkout-session member the column cannot hold (R2-G24).
 *
 * The schema declares `status` and `step` as `String`, so GraphQL validation lets any text through, and it
 * reached the columns: a status outside the enumeration was stored (or, past the column's 16 characters, a
 * database error), and a step past 64 characters was a database error — a 500 for what the REST body
 * (`@IsEnum`, `@MaxLength(64)`) answers with a 400. An omitted member is not checked.
 *
 * The refusals are `ApiException`s with catalogued codes — `VALIDATION_INVALID_ENUM` for the status,
 * `VALIDATION_FAILED` for the step — so the GraphQL error filter carries the code and the details to the
 * client (Greptile, #10905); the specific reason is `details.reason`.
 *
 * @param input The members as the input carried them.
 * @throws ApiException `400`, reason `CHECKOUT_SESSION_STATUS_INVALID` or `CHECKOUT_STEP_INVALID`.
 */
export function assertCheckoutSessionMembers(input: { status?: unknown; step?: unknown } | null | undefined): void {
	const { status, step } = input ?? {};

	if (status !== undefined && status !== null && !isCheckoutSessionStatus(status)) {
		throw new ApiException(
			400,
			ApiErrorCode.VALIDATION_INVALID_ENUM,
			`CHECKOUT_SESSION_STATUS_INVALID: status "${String(status)}" is not one of: ${CHECKOUT_SESSION_STATUSES.join(', ')}.`,
			{
				field: 'status',
				value: status,
				allowed: CHECKOUT_SESSION_STATUSES,
				reason: 'CHECKOUT_SESSION_STATUS_INVALID'
			}
		);
	}

	if (step !== undefined && step !== null && (typeof step !== 'string' || step.length > CHECKOUT_STEP_MAX_LENGTH)) {
		throw new ApiException(
			400,
			ApiErrorCode.VALIDATION_FAILED,
			`CHECKOUT_STEP_INVALID: a step is a string of at most ${CHECKOUT_STEP_MAX_LENGTH} characters.`,
			{ field: 'step', maxLength: CHECKOUT_STEP_MAX_LENGTH, reason: 'CHECKOUT_STEP_INVALID' }
		);
	}
}
