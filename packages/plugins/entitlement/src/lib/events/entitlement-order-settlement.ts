import { ID, OrderPaymentStatus, OrderStatus } from '@gauzy/contracts';
import { EntitlementRevocationReason, IEntitlementOrderLineState, IEntitlementOrderState } from '../entitlement.types';

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
 * Only a capture in full counts. A partial capture and an authorisation are not read as settled: a right left
 * `PENDING` that the next settlement event puts into force is the cautious answer, and one put into force for
 * money that did not settle is not.
 */
export const ENTITLEMENT_SETTLED_PAYMENT_STATUSES: readonly string[] = [OrderPaymentStatus.CAPTURED];

/** The order statuses that withdraw what the order granted, whatever the money says. */
export const ENTITLEMENT_WITHDRAWN_ORDER_STATUSES: readonly string[] = [OrderStatus.CANCELED];

/**
 * The payment statuses that withdraw what the order granted, whatever the lifecycle says.
 *
 * An order that completed and was then refunded in full still reads `COMPLETED`; its money says otherwise.
 */
export const ENTITLEMENT_WITHDRAWN_PAYMENT_STATUSES: readonly string[] = [OrderPaymentStatus.REFUNDED];

/**
 * The payment statuses that rule a settlement out without withdrawing anything: a cancelled payment leaves the
 * order unpaid, and a later payment may still settle it.
 */
export const ENTITLEMENT_UNSETTLED_PAYMENT_STATUSES: readonly string[] = [OrderPaymentStatus.CANCELED];

/**
 * The payment statuses under which the order as a whole cannot say whether a line is still paid for: some of the
 * money was paid back, and only the lines say whose.
 */
export const ENTITLEMENT_LINE_DECIDED_PAYMENT_STATUSES: readonly string[] = [OrderPaymentStatus.PARTIALLY_REFUNDED];

/** Whether a timestamp the order port answered is set. */
function isSet(value: Date | string | null | undefined): boolean {
	return value !== null && value !== undefined && value !== '';
}

/**
 * Why an order's state withdraws what it granted, if it does: it was cancelled, or its money was refunded in full.
 *
 * The cancellation is read from the status and from `canceledAt`, which archiving keeps when it replaces the status
 * with `ARCHIVED`; it wins over a refund, as the order's own lifecycle does.
 *
 * @param state The order's state, as the order port answered it; `null` when the order was not found.
 * @returns The revocation reason the matching event would have withdrawn the rights with, or `null` when the
 * order still grants what it granted.
 */
export function orderWithdrawalReason(
	state: IEntitlementOrderState | null | undefined
): (typeof EntitlementRevocationReason)[keyof typeof EntitlementRevocationReason] | null {
	if (!state) {
		return null;
	}

	if (ENTITLEMENT_WITHDRAWN_ORDER_STATUSES.includes(String(state.status ?? '')) || isSet(state.canceledAt)) {
		return EntitlementRevocationReason.ORDER_CANCELED;
	}

	if (ENTITLEMENT_WITHDRAWN_PAYMENT_STATUSES.includes(String(state.paymentStatus ?? ''))) {
		return EntitlementRevocationReason.REFUNDED;
	}

	return null;
}

/**
 * Whether an order's state withdraws what it granted (see {@link orderWithdrawalReason}).
 *
 * A late `order.placed` asks this before it grants anything (#11023). When the cancellation or the refund was
 * delivered first, there was no right yet for it to withdraw, so a placement that granted now would leave a
 * `PENDING` right that nothing withdraws; it grants nothing instead.
 *
 * @param state The order's state, as the order port answered it; `null` when the order was not found.
 * @returns True when the order no longer grants anything.
 */
export function isOrderWithdrawn(state: IEntitlementOrderState | null | undefined): boolean {
	return orderWithdrawalReason(state) !== null;
}

/**
 * Whether an order's state says it settled — the state the grant consumer acts on when it receives
 * `order.completed` or `payment.captured`.
 *
 * A late `order.placed` asks this of the order it granted from (#11023): when the settlement was delivered first,
 * it put nothing into force, and the rights the placement grants are put into force by the placement instead.
 *
 * The vetoes come first. A withdrawn order ({@link isOrderWithdrawn}) is never settled, so a cancellation or a full
 * refund delivered first is not undone by the capture or the `COMPLETED` the order still records, and neither is
 * an order whose payment was cancelled. Then completion settles it, read from the status or from `completedAt`.
 * An `ARCHIVED` order hides whether it completed or was cancelled, so for it only the timestamps count: its
 * payment status alone does not settle it.
 *
 * @param state The order's state, as the order port answered it; `null` when the order was not found.
 * @returns True when the rights the order granted should be in force, line by line (see
 * {@link activatableOrderLines}).
 */
export function isOrderSettled(state: IEntitlementOrderState | null | undefined): boolean {
	if (!state || isOrderWithdrawn(state)) {
		return false;
	}

	const status = String(state.status ?? '');
	const paymentStatus = String(state.paymentStatus ?? '');

	if (ENTITLEMENT_UNSETTLED_PAYMENT_STATUSES.includes(paymentStatus)) {
		return false;
	}

	if (ENTITLEMENT_SETTLED_ORDER_STATUSES.includes(status) || isSet(state.completedAt)) {
		return true;
	}

	if (status === OrderStatus.ARCHIVED) {
		return false;
	}

	return ENTITLEMENT_SETTLED_PAYMENT_STATUSES.includes(paymentStatus);
}

/**
 * Whether a line is still paid for in full: something was bought on it and nothing has been refunded on it.
 *
 * @param line The line, as the order port answered it.
 * @returns True only for a positive bought quantity and a refunded quantity of zero; false when either is not a
 * number.
 */
export function isOrderLinePaidInFull(line: IEntitlementOrderLineState): boolean {
	const quantity = Number(line.quantity ?? 0);
	const refunded = Number(line.refundedQuantity ?? 0);

	return Number.isFinite(quantity) && Number.isFinite(refunded) && quantity > 0 && refunded <= 0;
}

/**
 * The lines whose rights a late `order.placed` puts into force: the lines it granted from that are still paid for
 * in full, on an order that settled.
 *
 * The order as a whole cannot say that once part of its money was paid back: refunding one of two lines leaves it
 * `COMPLETED` with payment `PARTIALLY_REFUNDED`, and if that refund was delivered before the placement there is no
 * refund left to withdraw the refunded line's right. So the decision is taken per line:
 *
 * - when the order port answers the lines, a line is put into force only while nothing has been refunded on it
 *   ({@link isOrderLinePaidInFull}); a line the port does not list is not, because nothing says it is paid for;
 * - when it does not, and the order is refunded in part, nothing is put into force; otherwise every line is.
 *
 * A line refunded in part is left out too, rather than put into force at a lowered quantity. Its right still
 * carries the quantity the placement granted, and lowering it here would apply the refund a second time when that
 * refund's own `payment.refunded` delivery, possibly still queued, subtracts it again — the refund handler lowers
 * by what it is told was refunded, it does not reconcile to a total. Left `PENDING`, the right takes that delivery
 * once, and an operator or a later settlement puts it into force.
 *
 * A line left out keeps its right `PENDING`, which is what it was before #11023.
 *
 * @param state The order's state, as the order port answered it.
 * @param orderLineIds The lines the placement granted rights for.
 * @returns The lines whose rights to put into force, each once, in the order given.
 */
export function activatableOrderLines(
	state: IEntitlementOrderState | null | undefined,
	orderLineIds: readonly ID[]
): ID[] {
	if (!state || !isOrderSettled(state)) {
		return [];
	}

	const wanted = [...new Set(orderLineIds.filter(Boolean))];

	if (Array.isArray(state.lines)) {
		const lines = new Map(state.lines.map((line) => [String(line.id), line]));

		return wanted.filter((orderLineId) => {
			const line = lines.get(String(orderLineId));

			return line !== undefined && isOrderLinePaidInFull(line);
		});
	}

	if (ENTITLEMENT_LINE_DECIDED_PAYMENT_STATUSES.includes(String(state.paymentStatus ?? ''))) {
		return [];
	}

	return wanted;
}
