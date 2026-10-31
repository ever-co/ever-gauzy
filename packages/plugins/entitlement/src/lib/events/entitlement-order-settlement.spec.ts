import { OrderPaymentStatus, OrderStatus } from '@gauzy/contracts';
import { EntitlementRevocationReason } from '../entitlement.types';
import {
	ENTITLEMENT_LINE_DECIDED_PAYMENT_STATUSES,
	ENTITLEMENT_SETTLED_ORDER_STATUSES,
	ENTITLEMENT_SETTLED_PAYMENT_STATUSES,
	ENTITLEMENT_UNSETTLED_PAYMENT_STATUSES,
	ENTITLEMENT_WITHDRAWN_ORDER_STATUSES,
	ENTITLEMENT_WITHDRAWN_PAYMENT_STATUSES,
	activatableOrderLines,
	isOrderSettled,
	isOrderWithdrawn,
	orderWithdrawalReason,
	remainingOrderLineQuantity
} from './entitlement-order-settlement';

/**
 * #11023 — what a late `order.placed` reads from the order it granted from.
 *
 * The rules repeat what the order's events announce, and nothing more generous: an order withdrawn by its
 * cancellation or its full refund grants nothing; a settled order is one that completed (what `order.completed`
 * says) or whose money was captured in full (what `payment.captured` says); and on a settled order only the
 * lines still paid for are put into force.
 */
const COMPLETED_AT = new Date('2026-10-01T10:00:00Z');
const CANCELED_AT = new Date('2026-10-02T10:00:00Z');

describe('orderWithdrawalReason / isOrderWithdrawn', () => {
	it('withdraws a cancelled order, whatever its money says', () => {
		for (const paymentStatus of [OrderPaymentStatus.CAPTURED, OrderPaymentStatus.NOT_PAID, undefined]) {
			const state = { status: OrderStatus.CANCELED, paymentStatus };

			expect(orderWithdrawalReason(state)).toBe(EntitlementRevocationReason.ORDER_CANCELED);
			expect(isOrderWithdrawn(state)).toBe(true);
		}
	});

	it('withdraws an order refunded in full, even though it still reads COMPLETED', () => {
		const state = { status: OrderStatus.COMPLETED, paymentStatus: OrderPaymentStatus.REFUNDED };

		expect(orderWithdrawalReason(state)).toBe(EntitlementRevocationReason.REFUNDED);
		expect(isOrderWithdrawn(state)).toBe(true);
	});

	it('reads a cancellation from canceledAt once archiving replaced the status, and lets it win over a refund', () => {
		expect(orderWithdrawalReason({ status: OrderStatus.ARCHIVED, canceledAt: CANCELED_AT })).toBe(
			EntitlementRevocationReason.ORDER_CANCELED
		);
		expect(
			orderWithdrawalReason({
				status: OrderStatus.ARCHIVED,
				paymentStatus: OrderPaymentStatus.REFUNDED,
				canceledAt: CANCELED_AT.toISOString()
			})
		).toBe(EntitlementRevocationReason.ORDER_CANCELED);
	});

	it('does not withdraw an order refunded in part, an unpaid one, or one whose payment was cancelled', () => {
		for (const paymentStatus of [
			OrderPaymentStatus.PARTIALLY_REFUNDED,
			OrderPaymentStatus.NOT_PAID,
			OrderPaymentStatus.CANCELED
		]) {
			expect(isOrderWithdrawn({ status: OrderStatus.COMPLETED, paymentStatus })).toBe(false);
		}
	});

	it('withdraws nothing for an order that was not found, or that states nothing', () => {
		expect(orderWithdrawalReason(null)).toBeNull();
		expect(isOrderWithdrawn(undefined)).toBe(false);
		expect(isOrderWithdrawn({})).toBe(false);
		expect(isOrderWithdrawn({ canceledAt: null, completedAt: '' })).toBe(false);
	});
});

describe('isOrderSettled', () => {
	it('reads a completed order as settled', () => {
		expect(isOrderSettled({ status: OrderStatus.COMPLETED, paymentStatus: OrderPaymentStatus.NOT_PAID })).toBe(
			true
		);
		expect(isOrderSettled({ status: OrderStatus.COMPLETED })).toBe(true);
	});

	it('reads a captured order as settled, whatever its open lifecycle status', () => {
		for (const status of [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PROCESSING, undefined, null]) {
			expect(isOrderSettled({ status, paymentStatus: OrderPaymentStatus.CAPTURED })).toBe(true);
		}
	});

	it('never reads a withdrawn order as settled, even with the money captured or the order completed', () => {
		expect(isOrderSettled({ status: OrderStatus.CANCELED, paymentStatus: OrderPaymentStatus.CAPTURED })).toBe(
			false
		);
		expect(isOrderSettled({ status: OrderStatus.COMPLETED, paymentStatus: OrderPaymentStatus.REFUNDED })).toBe(
			false
		);
		expect(
			isOrderSettled({
				status: OrderStatus.ARCHIVED,
				paymentStatus: OrderPaymentStatus.CAPTURED,
				completedAt: COMPLETED_AT,
				canceledAt: CANCELED_AT
			})
		).toBe(false);
	});

	it('never reads an order whose payment was cancelled as settled, even though it completed', () => {
		expect(isOrderSettled({ status: OrderStatus.COMPLETED, paymentStatus: OrderPaymentStatus.CANCELED })).toBe(
			false
		);
	});

	it('still reads a completed order refunded in part as settled, leaving the lines to decide', () => {
		expect(
			isOrderSettled({ status: OrderStatus.COMPLETED, paymentStatus: OrderPaymentStatus.PARTIALLY_REFUNDED })
		).toBe(true);
	});

	it('reads an archived order by its timestamps: settled when it completed, never by its payment alone', () => {
		expect(isOrderSettled({ status: OrderStatus.ARCHIVED, completedAt: COMPLETED_AT })).toBe(true);
		expect(isOrderSettled({ status: OrderStatus.ARCHIVED, completedAt: COMPLETED_AT.toISOString() })).toBe(true);
		expect(isOrderSettled({ status: OrderStatus.ARCHIVED, paymentStatus: OrderPaymentStatus.CAPTURED })).toBe(
			false
		);
		expect(isOrderSettled({ status: OrderStatus.ARCHIVED, canceledAt: CANCELED_AT })).toBe(false);
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
});

describe('remainingOrderLineQuantity', () => {
	it('answers what was bought less what was refunded, never below zero', () => {
		expect(remainingOrderLineQuantity({ id: 'l', quantity: 3, refundedQuantity: 1 })).toBe(2);
		expect(remainingOrderLineQuantity({ id: 'l', quantity: '2.000000', refundedQuantity: '2.000000' })).toBe(0);
		expect(remainingOrderLineQuantity({ id: 'l', quantity: 1, refundedQuantity: 4 })).toBe(0);
		expect(remainingOrderLineQuantity({ id: 'l', quantity: 1 })).toBe(1);
	});

	it('answers zero when a quantity is missing or is not a number', () => {
		expect(remainingOrderLineQuantity({ id: 'l' })).toBe(0);
		expect(remainingOrderLineQuantity({ id: 'l', quantity: 'many', refundedQuantity: 0 })).toBe(0);
		expect(remainingOrderLineQuantity({ id: 'l', quantity: 2, refundedQuantity: 'some' })).toBe(0);
	});
});

describe('activatableOrderLines', () => {
	const SETTLED_IN_PART = { status: OrderStatus.COMPLETED, paymentStatus: OrderPaymentStatus.PARTIALLY_REFUNDED };

	it('puts into force only the lines with some of what was bought on them still paid for', () => {
		const state = {
			...SETTLED_IN_PART,
			lines: [
				{ id: 'kept', quantity: 1, refundedQuantity: 0 },
				{ id: 'refunded', quantity: 1, refundedQuantity: 1 },
				{ id: 'half', quantity: 2, refundedQuantity: 1 }
			]
		};

		expect(activatableOrderLines(state, ['kept', 'refunded', 'half'])).toEqual(['kept', 'half']);
	});

	it('leaves out a line the order port does not list, since nothing says it is paid for', () => {
		const state = { ...SETTLED_IN_PART, lines: [{ id: 'kept', quantity: 1, refundedQuantity: 0 }] };

		expect(activatableOrderLines(state, ['kept', 'unknown'])).toEqual(['kept']);
	});

	it('decides per line on a fully paid order too, when the port answers the lines', () => {
		const state = {
			status: OrderStatus.COMPLETED,
			paymentStatus: OrderPaymentStatus.CAPTURED,
			lines: [{ id: 'kept', quantity: 1, refundedQuantity: 0 }]
		};

		expect(activatableOrderLines(state, ['kept'])).toEqual(['kept']);
	});

	it('puts nothing into force on an order refunded in part when the port cannot answer the lines', () => {
		expect(activatableOrderLines(SETTLED_IN_PART, ['a', 'b'])).toEqual([]);
		expect(activatableOrderLines({ ...SETTLED_IN_PART, lines: null }, ['a'])).toEqual([]);
	});

	it('puts every line into force on a settled order not refunded in part when the port cannot answer the lines', () => {
		expect(
			activatableOrderLines({ status: OrderStatus.COMPLETED, paymentStatus: OrderPaymentStatus.CAPTURED }, [
				'a',
				'b'
			])
		).toEqual(['a', 'b']);
	});

	it('answers each line once, in the order given, and ignores empty ids', () => {
		expect(activatableOrderLines({ status: OrderStatus.COMPLETED }, ['b', 'a', 'b', '' as never])).toEqual([
			'b',
			'a'
		]);
	});

	it('puts nothing into force on an order that has not settled or was withdrawn', () => {
		const lines = [{ id: 'a', quantity: 1, refundedQuantity: 0 }];

		expect(activatableOrderLines({ status: OrderStatus.CONFIRMED, lines }, ['a'])).toEqual([]);
		expect(activatableOrderLines({ status: OrderStatus.CANCELED, lines }, ['a'])).toEqual([]);
		expect(activatableOrderLines(null, ['a'])).toEqual([]);
	});
});

describe('the statuses the rules decide on', () => {
	it('publishes them', () => {
		expect(ENTITLEMENT_SETTLED_ORDER_STATUSES).toEqual([OrderStatus.COMPLETED]);
		expect(ENTITLEMENT_SETTLED_PAYMENT_STATUSES).toEqual([OrderPaymentStatus.CAPTURED]);
		expect(ENTITLEMENT_WITHDRAWN_ORDER_STATUSES).toEqual([OrderStatus.CANCELED]);
		expect(ENTITLEMENT_WITHDRAWN_PAYMENT_STATUSES).toEqual([OrderPaymentStatus.REFUNDED]);
		expect(ENTITLEMENT_UNSETTLED_PAYMENT_STATUSES).toEqual([OrderPaymentStatus.CANCELED]);
		expect(ENTITLEMENT_LINE_DECIDED_PAYMENT_STATUSES).toEqual([OrderPaymentStatus.PARTIALLY_REFUNDED]);
	});
});
