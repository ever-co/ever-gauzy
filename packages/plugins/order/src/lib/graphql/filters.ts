import {
	FulfillmentStatus,
	OrderChangeActionType,
	OrderChangeStatus,
	OrderChangeType,
	OrderPaymentStatus,
	OrderStatus,
	OrderTransactionType
} from '@gauzy/contracts';
import { ApiErrorCode, ApiException } from '@gauzy/core';

/**
 * The state filters the order schema accepts, read into the enumerations the columns carry.
 *
 * A filter argument is declared as a `String` in the schema, so the value arrives as text and has to
 * be narrowed before it can stand as a predicate on an enumerated column. The narrowing is explicit
 * for that reason: an unknown value is refused rather than handed to the query, where it would match
 * nothing and read to the caller as an empty page rather than as a mistyped status.
 */
export const ORDER_STATUSES: readonly string[] = Object.values(OrderStatus);
export const ORDER_PAYMENT_STATUSES: readonly string[] = Object.values(OrderPaymentStatus);
export const FULFILLMENT_STATUSES: readonly string[] = Object.values(FulfillmentStatus);
export const ORDER_CHANGE_STATUSES: readonly string[] = Object.values(OrderChangeStatus);
export const ORDER_TRANSACTION_TYPES: readonly string[] = Object.values(OrderTransactionType);

/**
 * @param value An order status as the filter argument carried it.
 * @returns Whether it names one of the order's states.
 */
export function isOrderStatus(value: unknown): value is OrderStatus {
	return typeof value === 'string' && ORDER_STATUSES.includes(value);
}

/**
 * @param value A payment status as the filter argument carried it.
 * @returns Whether it names one of the order's payment states.
 */
export function isOrderPaymentStatus(value: unknown): value is OrderPaymentStatus {
	return typeof value === 'string' && ORDER_PAYMENT_STATUSES.includes(value);
}

/**
 * @param value A fulfilment status as the filter argument carried it.
 * @returns Whether it names one of the order's fulfilment states.
 */
export function isFulfillmentStatus(value: unknown): value is FulfillmentStatus {
	return typeof value === 'string' && FULFILLMENT_STATUSES.includes(value);
}

/**
 * @param value A change status as the filter argument carried it.
 * @returns Whether it names one of the change's states.
 */
export function isOrderChangeStatus(value: unknown): value is OrderChangeStatus {
	return typeof value === 'string' && ORDER_CHANGE_STATUSES.includes(value);
}

/**
 * @param value A transaction type as the filter argument carried it.
 * @returns Whether it names one of the ledger's movement kinds.
 */
export function isOrderTransactionType(value: unknown): value is OrderTransactionType {
	return typeof value === 'string' && ORDER_TRANSACTION_TYPES.includes(value);
}

/** The kinds of change and of change action an input may name (R2-G24). */
export const ORDER_CHANGE_TYPES: readonly string[] = Object.values(OrderChangeType);
export const ORDER_CHANGE_ACTION_TYPES: readonly string[] = Object.values(OrderChangeActionType);

/**
 * Refuses an input member that names no member of the enumeration its column carries (R2-G24).
 *
 * The schema declares these members as `String` — so a client that sends a value outside the enumeration
 * is not refused by GraphQL validation, and the value reached the column: a value longer than the column
 * was a database error (500), a shorter one was stored and failed later, where nothing could say why. The
 * REST bodies validate the same members with `@IsEnum`, so this is the GraphQL half of the same rule, and
 * it answers 400 with the members the column accepts. An omitted member (`undefined` or `null`) is not
 * checked: whether it is required is the write's own rule.
 *
 * The refusal is an `ApiException` with the catalogued `VALIDATION_INVALID_ENUM`, because that is what the
 * GraphQL error filter reads its `extensions.code` and `extensions.details` from — a plain
 * `BadRequestException` reaches a GraphQL client as a bare `VALIDATION_FAILED` with no details (Greptile,
 * #10905). The specific reason travels in `details.reason`, beside the member, the value and the accepted
 * values.
 *
 * @param value The member as the input carried it.
 * @param allowed The members of the enumeration.
 * @param field The input member's name, for the answer.
 * @param reason The specific reason, e.g. `ORDER_CHANGE_TYPE_INVALID`.
 * @throws ApiException `400 VALIDATION_INVALID_ENUM`.
 */
export function assertEnumMember(value: unknown, allowed: readonly string[], field: string, reason: string): void {
	if (value === undefined || value === null) {
		return;
	}

	if (typeof value !== 'string' || !allowed.includes(value)) {
		throw new ApiException(
			400,
			ApiErrorCode.VALIDATION_INVALID_ENUM,
			`${reason}: ${field} "${String(value)}" is not one of: ${allowed.join(', ')}.`,
			{ field, value, allowed, reason }
		);
	}
}
