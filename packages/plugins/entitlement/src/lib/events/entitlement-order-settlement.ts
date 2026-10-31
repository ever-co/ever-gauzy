import { OrderPaymentStatus, OrderStatus } from '@gauzy/contracts';
import { IEntitlementOrderState } from '../entitlement.types';

/**
 * The order statuses that say the order settled, as `order.completed` announces it.
 *
 * `COMPLETED` is written in the same transaction that appends `order.completed`, which is what makes the
 * order row a durable record of the settlement a reordered delivery may have consumed too early.
 */
export const ENTITLEMENT_SETTLED_ORDER_STATUSES: readonly string[] = [OrderStatus.COMPLETED];

/**
 * The payment statuses that say the money settled, as `payment.captured` announces it.
 *
 * Only a capture in full counts. A partial capture, an authorisation and a refunded order are not read as
 * settled: a right left `PENDING` that an operator or the next settlement event puts into force is the
 * cautious answer, and one put into force for money that did not settle is not.
 */
export const ENTITLEMENT_SETTLED_PAYMENT_STATUSES: readonly string[] = [OrderPaymentStatus.CAPTURED];

/** The order statuses that rule a settlement out, whatever the money says. */
export const ENTITLEMENT_UNSETTLED_ORDER_STATUSES: readonly string[] = [OrderStatus.CANCELED];

/**
 * The payment statuses that rule a settlement out, whatever the lifecycle says.
 *
 * An order that completed and was then refunded in full, or whose payment was cancelled, can still read
 * `COMPLETED`. If its refund was delivered before the placement, there was no right yet to withdraw, so a
 * late placement must not put one into force either: it leaves the rights `PENDING`, which is what it did
 * before #11023.
 */
export const ENTITLEMENT_UNSETTLED_PAYMENT_STATUSES: readonly string[] = [
	OrderPaymentStatus.REFUNDED,
	OrderPaymentStatus.CANCELED
];

/**
 * Whether an order's state says it settled — the state the grant consumer acts on when it receives
 * `order.completed` or `payment.captured`.
 *
 * A late `order.placed` asks this of the order it granted from (#11023): when the settlement was delivered
 * first, it put nothing into force, and the rights the placement grants are put into force here instead.
 * A cancelled order is never settled, so a cancellation delivered first is not undone by a capture the
 * order still records; nor is an order whose money was refunded in full or cancelled, so a refund delivered
 * first is not undone by the `COMPLETED` the order still reads.
 *
 * @param state The order's state, as the order port answered it; `null` when the order was not found.
 * @returns True when the rights the order granted should be in force.
 */
export function isOrderSettled(state: IEntitlementOrderState | null | undefined): boolean {
	if (!state) {
		return false;
	}

	const status = String(state.status ?? '');
	const paymentStatus = String(state.paymentStatus ?? '');

	if (
		ENTITLEMENT_UNSETTLED_ORDER_STATUSES.includes(status) ||
		ENTITLEMENT_UNSETTLED_PAYMENT_STATUSES.includes(paymentStatus)
	) {
		return false;
	}

	return (
		ENTITLEMENT_SETTLED_ORDER_STATUSES.includes(status) ||
		ENTITLEMENT_SETTLED_PAYMENT_STATUSES.includes(paymentStatus)
	);
}
