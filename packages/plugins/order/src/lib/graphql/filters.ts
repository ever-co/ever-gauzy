import {
	FulfillmentStatus,
	OrderChangeStatus,
	OrderPaymentStatus,
	OrderStatus,
	OrderTransactionType
} from '@gauzy/contracts';

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
