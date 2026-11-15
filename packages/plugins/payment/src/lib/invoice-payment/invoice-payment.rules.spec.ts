import { InvoiceStatusTypesEnum } from '@gauzy/contracts';
import {
	InvoicePaymentOutcome,
	amountDueOf,
	confirmedAmountOf,
	isPayable,
	readNotification,
	standingAfterPayments
} from './invoice-payment.rules';

/** The rules of paying an invoice online (ever-co/ever-gauzy#11856). */
const INVOICE = { isEstimate: false, status: InvoiceStatusTypesEnum.SENT, currency: 'EUR', totalValue: 120.5 };
const REFERENCE = '0b6e4c2a-1d3f-4e5a-8b7c-9d0e1f2a3b4c';

const body = (value: unknown) => Buffer.from(JSON.stringify(value));
const succeeded = (data: Record<string, unknown> = {}) =>
	body({
		id: 'evt_1',
		type: 'payment.succeeded',
		data: { reference: REFERENCE, paymentId: 'pay_1', amount: '120.50', currency: 'eur', ...data }
	});

describe('amountDueOf', () => {
	it('is the total less the payments in the invoice currency', () => {
		const due = amountDueOf(INVOICE, [
			{ amount: 20, currency: 'EUR' },
			{ amount: '0.50', currency: 'EUR' },
			{ amount: 99, currency: 'USD' }
		]);
		expect(due?.amount).toBe('100');
		expect(due?.currency).toBe('EUR');
	});

	it('never goes below zero', () => {
		expect(amountDueOf(INVOICE, [{ amount: 200, currency: 'EUR' }])?.amount).toBe('0');
	});

	it('is unknown for an invoice without a total or a currency', () => {
		expect(amountDueOf({ ...INVOICE, totalValue: null }, [])).toBeNull();
		expect(amountDueOf({ ...INVOICE, currency: null }, [])).toBeNull();
	});
});

describe('isPayable', () => {
	const due = amountDueOf(INVOICE, []);

	it.each([InvoiceStatusTypesEnum.SENT, InvoiceStatusTypesEnum.VIEWED, InvoiceStatusTypesEnum.PARTIALLY_PAID])(
		'offers to pay a %s invoice with something due',
		(status) => {
			expect(isPayable({ ...INVOICE, status }, due)).toBe(true);
		}
	);

	it.each([
		InvoiceStatusTypesEnum.DRAFT,
		InvoiceStatusTypesEnum.FULLY_PAID,
		InvoiceStatusTypesEnum.OVERPAID,
		InvoiceStatusTypesEnum.VOID
	])('never offers to pay a %s invoice', (status) => {
		expect(isPayable({ ...INVOICE, status }, due)).toBe(false);
	});

	it('never offers to pay an estimate, or an invoice with nothing due', () => {
		expect(isPayable({ ...INVOICE, isEstimate: true }, due)).toBe(false);
		expect(isPayable(INVOICE, amountDueOf(INVOICE, [{ amount: 120.5, currency: 'EUR' }]))).toBe(false);
	});
});

describe('standingAfterPayments', () => {
	it('is Partially paid below the total', () => {
		expect(standingAfterPayments(INVOICE, [{ amount: 20, currency: 'EUR' }])).toEqual({
			alreadyPaid: '20',
			amountDue: '100.5',
			paid: false,
			status: InvoiceStatusTypesEnum.PARTIALLY_PAID
		});
	});

	it('is Paid at the total', () => {
		expect(
			standingAfterPayments(INVOICE, [
				{ amount: 20, currency: 'EUR' },
				{ amount: '100.50', currency: 'EUR' }
			])
		).toEqual({ alreadyPaid: '120.5', amountDue: '0', paid: true, status: InvoiceStatusTypesEnum.FULLY_PAID });
	});

	it('is Overpaid past the total, with nothing due', () => {
		expect(standingAfterPayments(INVOICE, [{ amount: 130, currency: 'EUR' }])).toMatchObject({
			amountDue: '0',
			paid: true,
			status: InvoiceStatusTypesEnum.OVERPAID
		});
	});
});

describe('readNotification', () => {
	it('reads a payment that succeeded', () => {
		expect(readNotification(succeeded())).toEqual({
			eventId: 'evt_1',
			type: 'payment.succeeded',
			outcome: InvoicePaymentOutcome.SUCCEEDED,
			reference: REFERENCE,
			paymentId: 'pay_1',
			amount: '120.50',
			currency: 'EUR'
		});
	});

	it('reads a type it does not know with no outcome', () => {
		expect(
			readNotification(
				body({ id: 'evt_2', type: 'payout.paid', data: { reference: REFERENCE, amount: 1, currency: 'EUR' } })
			)
		).toMatchObject({
			outcome: null,
			amount: '1'
		});
	});

	it.each([
		['no body', undefined],
		['a body that is not JSON', Buffer.from('id=evt_1')],
		['a list', body([])],
		['no id', body({ type: 'payment.succeeded', data: { reference: REFERENCE, amount: '1', currency: 'EUR' } })],
		['a reference that is not an invoice id', succeeded({ reference: "' OR 1=1" })],
		['no amount', succeeded({ amount: '' })],
		['no currency', succeeded({ currency: null })]
	])('refuses %s', (_label, raw) => {
		expect(readNotification(raw as Buffer | undefined)).toBeNull();
	});
});

describe('confirmedAmountOf', () => {
	const notification = readNotification(succeeded());

	it('is the amount in the invoice currency', () => {
		expect(confirmedAmountOf(INVOICE, notification)?.amount).toBe('120.5');
	});

	it('refuses another currency than the invoice’s', () => {
		expect(confirmedAmountOf({ ...INVOICE, currency: 'USD' }, notification)).toBeNull();
	});

	it('refuses an amount that is not positive, or not an amount', () => {
		expect(confirmedAmountOf(INVOICE, readNotification(succeeded({ amount: '0' })))).toBeNull();
		expect(confirmedAmountOf(INVOICE, readNotification(succeeded({ amount: '-5' })))).toBeNull();
		expect(confirmedAmountOf(INVOICE, readNotification(succeeded({ amount: '12abc' })))).toBeNull();
	});
});
