import { IPaymentOrderMoneyFact } from '../payment.types';
import { PaymentOrderLedgerMirror } from './payment-order-ledger.mirror';

/**
 * Q7-W1b — the payment side's report to the order's money ledger never fails the payment.
 */
const fact = (overrides: Partial<IPaymentOrderMoneyFact> = {}): IPaymentOrderMoneyFact => ({
	orderId: 'order-1',
	type: 'CAPTURE',
	amount: '40' as never,
	currency: 'USD',
	referenceType: 'PAYMENT_CAPTURE',
	referenceId: 'capture-1',
	...overrides
});

describe('PaymentOrderLedgerMirror (Q7-W1b)', () => {
	beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));
	afterEach(() => jest.restoreAllMocks());

	it('reports a fact about an order to the bound ledger and answers what it said', async () => {
		const ledger = {
			record: jest.fn(async (_fact: IPaymentOrderMoneyFact) => ({ recorded: true, transactionId: 't-1' }))
		};
		const mirror = new PaymentOrderLedgerMirror(ledger);

		await expect(mirror.mirror(fact(), 'capture capture-1')).resolves.toEqual({
			recorded: true,
			transactionId: 't-1'
		});
		expect(ledger.record).toHaveBeenCalledWith(fact());
	});

	it('reports nothing for a payment that pays no order', async () => {
		const ledger = { record: jest.fn() };
		const mirror = new PaymentOrderLedgerMirror(ledger);

		await expect(mirror.mirror(fact({ orderId: undefined }), 'capture')).resolves.toBeUndefined();
		expect(ledger.record).not.toHaveBeenCalled();
	});

	it('names the gap when no order ledger is registered, and does not throw', async () => {
		const mirror = new PaymentOrderLedgerMirror();

		await expect(mirror.mirror(fact(), 'capture capture-1')).resolves.toBeUndefined();
		expect(String((console.log as jest.Mock).mock.calls[0][0])).toContain('PAYMENT_ORDER_LEDGER_UNAVAILABLE');
	});

	it('absorbs a refused report: the money already moved, so the payment is not failed', async () => {
		const ledger = {
			record: jest.fn(async () => {
				throw new Error('ORDER_TRANSACTION_CURRENCY_MISMATCH');
			})
		};
		const mirror = new PaymentOrderLedgerMirror(ledger as never);

		await expect(mirror.mirror(fact(), 'capture capture-1')).resolves.toBeUndefined();
		expect(String((console.log as jest.Mock).mock.calls[0][0])).toContain('PAYMENT_ORDER_LEDGER_FAILED');
	});

	it('reports several facts one by one, a refused one not stopping the rest', async () => {
		const ledger = {
			record: jest.fn().mockRejectedValueOnce(new Error('refused')).mockResolvedValueOnce({ recorded: true })
		};
		const mirror = new PaymentOrderLedgerMirror(ledger as never);

		await mirror.mirrorAll([fact({ type: 'AUTHORIZATION', referenceType: 'PAYMENT' }), fact()], 'checkout');

		expect(ledger.record).toHaveBeenCalledTimes(2);
	});
});
