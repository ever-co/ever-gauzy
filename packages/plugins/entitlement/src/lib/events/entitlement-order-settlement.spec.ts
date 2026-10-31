import { OrderPaymentStatus, OrderStatus } from '@gauzy/contracts';
import {
	ENTITLEMENT_SETTLED_ORDER_STATUSES,
	ENTITLEMENT_SETTLED_PAYMENT_STATUSES,
	ENTITLEMENT_UNSETTLED_ORDER_STATUSES,
	ENTITLEMENT_UNSETTLED_PAYMENT_STATUSES,
	isOrderSettled
} from './entitlement-order-settlement';

/**
 * #11023 — what a late `order.placed` reads as "the order has already settled".
 *
 * The rule repeats what the settlement events announce, and nothing more generous: `COMPLETED` (what
 * `order.completed` says) or a capture in full (what `payment.captured` says), and never a cancelled order or
 * one whose money was refunded in full or cancelled.
 */
describe('isOrderSettled', () => {
	it('reads a completed order as settled', () => {
		expect(isOrderSettled({ status: OrderStatus.COMPLETED, paymentStatus: OrderPaymentStatus.NOT_PAID })).toBe(
			true
		);
		expect(isOrderSettled({ status: OrderStatus.COMPLETED })).toBe(true);
	});

	it('reads a captured order as settled, whatever its lifecycle status short of cancellation', () => {
		for (const status of [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PROCESSING, undefined, null]) {
			expect(isOrderSettled({ status, paymentStatus: OrderPaymentStatus.CAPTURED })).toBe(true);
		}
	});

	it('never reads a cancelled order as settled, even with the money captured', () => {
		expect(isOrderSettled({ status: OrderStatus.CANCELED, paymentStatus: OrderPaymentStatus.CAPTURED })).toBe(
			false
		);
	});

	it('never reads an order refunded in full, or whose payment was cancelled, as settled, even though it completed', () => {
		expect(isOrderSettled({ status: OrderStatus.COMPLETED, paymentStatus: OrderPaymentStatus.REFUNDED })).toBe(
			false
		);
		expect(isOrderSettled({ status: OrderStatus.COMPLETED, paymentStatus: OrderPaymentStatus.CANCELED })).toBe(
			false
		);
	});

	it('still reads a completed order refunded in part as settled', () => {
		expect(
			isOrderSettled({ status: OrderStatus.COMPLETED, paymentStatus: OrderPaymentStatus.PARTIALLY_REFUNDED })
		).toBe(true);
	});

	it('reads every other payment state as not yet settled', () => {
		const unsettled = Object.values(OrderPaymentStatus).filter((value) => value !== OrderPaymentStatus.CAPTURED);

		expect(unsettled.length).toBeGreaterThan(0);

		for (const paymentStatus of unsettled) {
			expect(isOrderSettled({ status: OrderStatus.CONFIRMED, paymentStatus })).toBe(false);
		}
	});

	it('reads every other lifecycle status as not yet settled when the money has not been captured', () => {
		for (const status of Object.values(OrderStatus).filter((value) => value !== OrderStatus.COMPLETED)) {
			expect(isOrderSettled({ status, paymentStatus: OrderPaymentStatus.AUTHORIZED })).toBe(false);
		}
	});

	it('reads an order that was not found, or that states nothing, as not settled', () => {
		expect(isOrderSettled(null)).toBe(false);
		expect(isOrderSettled(undefined)).toBe(false);
		expect(isOrderSettled({})).toBe(false);
	});

	it('publishes the statuses it decides on', () => {
		expect(ENTITLEMENT_SETTLED_ORDER_STATUSES).toEqual([OrderStatus.COMPLETED]);
		expect(ENTITLEMENT_SETTLED_PAYMENT_STATUSES).toEqual([OrderPaymentStatus.CAPTURED]);
		expect(ENTITLEMENT_UNSETTLED_ORDER_STATUSES).toEqual([OrderStatus.CANCELED]);
		expect(ENTITLEMENT_UNSETTLED_PAYMENT_STATUSES).toEqual([
			OrderPaymentStatus.REFUNDED,
			OrderPaymentStatus.CANCELED
		]);
	});
});
