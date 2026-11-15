import { InvoiceStatusTypesEnum } from '@gauzy/contracts';
import { Money } from '@gauzy/core';

/**
 * The rules of paying an invoice online, as pure functions: what is still owed, whether the public page offers to pay
 * it, what a payment the provider confirmed makes of the invoice, and what a connector's notification says.
 */

/** The code of the provider registration an organization's payment connector is: see the plugin's README. */
export const SIGNED_CHECKOUT_PROVIDER_CODE = 'signed-checkout';

/** The statuses whose invoice the client may still pay online: sent and not paid in full. */
const PAYABLE_STATUSES: ReadonlySet<string> = new Set([
	InvoiceStatusTypesEnum.SENT,
	InvoiceStatusTypesEnum.VIEWED,
	InvoiceStatusTypesEnum.PARTIALLY_PAID
]);

/** What of an invoice the rules read. */
export interface IPayableInvoice {
	isEstimate?: boolean | null;
	status?: string | null;
	currency?: string | null;
	totalValue?: number | string | null;
}

/** The amount and currency of a recorded payment, as the rules read them. */
export interface IRecordedAmount {
	amount?: number | string | null;
	currency?: string | null;
}

/** A Money from a stored amount, or null when the amount or the currency is not one. */
function moneyOf(amount: number | string | null | undefined, currency: string | null | undefined): Money | null {
	if (amount === null || amount === undefined || amount === '' || !currency) {
		return null;
	}
	try {
		return Money.of(typeof amount === 'number' ? String(amount) : amount, currency);
	} catch {
		return null;
	}
}

/**
 * What the client still owes: the invoice's total less the payments recorded against it, never below zero. Only the
 * payments in the invoice's currency count; another currency cannot be summed with it.
 *
 * @returns The amount due, or null when the invoice has no total or no currency.
 */
export function amountDueOf(invoice: IPayableInvoice, payments: ReadonlyArray<IRecordedAmount>): Money | null {
	const total = moneyOf(invoice.totalValue, invoice.currency);
	if (!total) {
		return null;
	}
	const paid = paidOf(total.currency, payments);
	const due = total.subtract(paid);
	return due.isNegative() ? Money.zero(total.currency) : due;
}

/** The sum of the payments in one currency. */
function paidOf(currency: string, payments: ReadonlyArray<IRecordedAmount>): Money {
	let paid = Money.zero(currency);
	for (const payment of payments) {
		const amount = moneyOf(payment.amount, payment.currency);
		if (amount && amount.currency === paid.currency) {
			paid = paid.add(amount);
		}
	}
	return paid;
}

/**
 * Whether a payment the provider confirmed may change the invoice's standing: never a voided invoice's. A void is final
 * (`invoice-final-status.ts`); a payment that lands after it is recorded against the invoice for the team to refund,
 * and the invoice stays void.
 */
export function standingMayChange(invoice: IPayableInvoice): boolean {
	return invoice.status !== InvoiceStatusTypesEnum.VOID;
}

/** Whether the client may pay an invoice online: a sent invoice, not an estimate, with something left to pay. */
export function isPayable(invoice: IPayableInvoice, amountDue: Money | null): boolean {
	return (
		!invoice.isEstimate &&
		PAYABLE_STATUSES.has(String(invoice.status ?? '')) &&
		amountDue !== null &&
		amountDue.isPositive()
	);
}

/** What the payments recorded against an invoice make of it. */
export interface IInvoiceStanding {
	alreadyPaid: string;
	amountDue: string;
	paid: boolean;
	status: InvoiceStatusTypesEnum;
}

/**
 * The invoice's standing once its payments are counted: Paid when they cover the total, Overpaid past it, Partially
 * paid below it. The stored columns are written as Ever Teams and the Gauzy app write them when a payment is entered
 * by hand.
 *
 * @returns The standing, or null when the invoice has no total or no currency to count against.
 */
export function standingAfterPayments(
	invoice: IPayableInvoice,
	payments: ReadonlyArray<IRecordedAmount>
): IInvoiceStanding | null {
	const total = moneyOf(invoice.totalValue, invoice.currency);
	if (!total) {
		return null;
	}
	const paid = paidOf(total.currency, payments);
	const comparison = paid.compare(total);
	const due = total.subtract(paid);
	return {
		alreadyPaid: paid.amount,
		amountDue: due.isNegative() ? '0' : due.amount,
		paid: comparison >= 0,
		status:
			comparison > 0
				? InvoiceStatusTypesEnum.OVERPAID
				: comparison === 0
					? InvoiceStatusTypesEnum.FULLY_PAID
					: InvoiceStatusTypesEnum.PARTIALLY_PAID
	};
}

/** What a connector's notification reports. */
export enum InvoicePaymentOutcome {
	/** The provider took the money: it is recorded against the invoice. */
	SUCCEEDED = 'payment.succeeded',
	/** The provider refused it: nothing changes. */
	FAILED = 'payment.failed',
	/** The client gave up: nothing changes. */
	CANCELED = 'payment.canceled'
}

/** A connector's notification, as the API reads it. */
export interface IInvoicePaymentNotification {
	/** The connector's own id of this notification: a second delivery of it is acknowledged and changes nothing. */
	eventId: string;
	type: string;
	outcome: InvoicePaymentOutcome | null;
	/** The invoice the checkout was opened for: its id, which the API sent as the checkout's reference. */
	reference: string;
	/**
	 * The provider's id of the payment, kept on the payment row: a payment is never recorded twice. Required for a
	 * payment that succeeded; null for another outcome that names none.
	 */
	paymentId: string | null;
	amount: string;
	currency: string;
	/**
	 * Whether the provider took the payment in its test mode. A test payment is never recorded against an invoice: a
	 * success that does not say it was live is read as a test.
	 */
	isTestMode: boolean;
}

const ID_SHAPE = /^[\w.:-]{1,255}$/;
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A string member of a parsed body, trimmed, or null. */
function textOf(value: unknown): string | null {
	return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/**
 * Reads a connector's notification from its body.
 *
 * ```json
 * { "id": "evt_1", "type": "payment.succeeded",
 *   "data": { "reference": "<invoice id>", "paymentId": "pay_1", "amount": "120.50", "currency": "EUR",
 *             "isTestMode": false } }
 * ```
 *
 * @returns The notification, or null when the body is not one. A type the rules do not know has a null outcome.
 */
export function readNotification(rawBody: Buffer | undefined): IInvoicePaymentNotification | null {
	if (!rawBody?.length) {
		return null;
	}
	let body: unknown;
	try {
		body = JSON.parse(rawBody.toString('utf8'));
	} catch {
		return null;
	}
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		return null;
	}
	const { id, type, data } = body as Record<string, unknown>;
	const eventId = textOf(id);
	const kind = textOf(type);
	if (!eventId || !ID_SHAPE.test(eventId) || !kind || !data || typeof data !== 'object') {
		return null;
	}
	const fields = data as Record<string, unknown>;
	const reference = textOf(fields['reference']);
	if (!reference || !UUID_SHAPE.test(reference)) {
		return null;
	}
	const outcomes = Object.values(InvoicePaymentOutcome) as string[];
	const outcome = outcomes.includes(kind) ? (kind as InvoicePaymentOutcome) : null;
	// A payment is recorded once per provider payment id: a success without one could be recorded twice under two
	// notification ids, so it is not a notification the API can apply
	const paymentId = textOf(fields['paymentId']);
	const hasPaymentId = paymentId !== null && ID_SHAPE.test(paymentId);
	if (paymentId !== null && !hasPaymentId) {
		return null;
	}
	if (outcome === InvoicePaymentOutcome.SUCCEEDED && !hasPaymentId) {
		return null;
	}
	const amount = typeof fields['amount'] === 'number' ? String(fields['amount']) : textOf(fields['amount']);
	const currency = textOf(fields['currency'])?.toUpperCase() ?? null;
	if (!amount || !currency) {
		return null;
	}
	return {
		eventId,
		type: kind,
		outcome,
		reference,
		paymentId,
		amount,
		currency,
		isTestMode: fields['isTestMode'] !== false
	};
}

/**
 * The amount a confirmed payment records, in the invoice's currency.
 *
 * @returns The amount, or null when the notification's currency is not the invoice's or its amount is not a positive
 * amount of money: such a payment is not recorded, and the notification is kept as failed for someone to look at.
 */
export function confirmedAmountOf(invoice: IPayableInvoice, notification: IInvoicePaymentNotification): Money | null {
	const amount = moneyOf(notification.amount, notification.currency);
	const invoiceCurrency = String(invoice.currency ?? '').toUpperCase();
	if (!amount || !amount.isPositive() || amount.currency !== invoiceCurrency) {
		return null;
	}
	return amount;
}
