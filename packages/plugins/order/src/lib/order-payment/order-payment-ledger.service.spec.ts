/**
 * Q7-W1b — the order's money ledger, as the payment domain writes to it.
 *
 * The collaborators are doubled at their module boundary: the suite is about what the ledger writes, how
 * often, with which sign, and that it gives the order its chance to complete — not about the order
 * service's own lifecycle, which has its suite.
 */
jest.mock('@gauzy/core', () => ({ ...jest.requireActual('@gauzy/core/src/lib/money/decimal') }));
jest.mock('../order/order.service', () => ({ OrderService: class {} }));
jest.mock('../order/order.entity', () => ({ Order: class {} }));
jest.mock('../order-totals/order-totals.service', () => ({ OrderTotalsService: class {} }));
jest.mock('../order-transaction/order-transaction.entity', () => ({ OrderTransaction: class {} }));
jest.mock('../order-transaction/order-transaction.service', () => ({ OrderTransactionService: class {} }));

import { OrderTransactionType } from '@gauzy/contracts';
import { IOrderMoneyFact } from '../order.types';
import { OrderPaymentLedgerService } from './order-payment-ledger.service';

const ORDER = { id: 'order-1', currency: 'USD', tenantId: 'tenant-1', organizationId: 'org-1' };

function fixture(options: { completeFails?: boolean } = {}) {
	const rows: any[] = [];
	const orderService = {
		findOneByIdString: jest.fn(async (id: string) => (id === ORDER.id ? { ...ORDER } : undefined)),
		completeIfSettled: jest.fn(async () => {
			if (options.completeFails) {
				throw new Error('ENTITY_VERSION_CONFLICT');
			}

			return ORDER;
		})
	};
	const transactionService = {
		find: jest.fn(async (options: any) =>
			rows.filter((row) => Object.entries(options.where).every(([key, value]) => row[key] === value))
		),
		create: jest.fn(async (input: any) => {
			const row = { id: `tx-${rows.length + 1}`, ...input };
			rows.push(row);

			return row;
		})
	};
	const totalsService = { recompute: jest.fn(async () => ORDER) };
	const ledger = new OrderPaymentLedgerService(
		orderService as never,
		transactionService as never,
		totalsService as never
	);

	return { ledger, rows, orderService, transactionService, totalsService };
}

const fact = (overrides: Partial<IOrderMoneyFact> = {}): IOrderMoneyFact => ({
	orderId: ORDER.id,
	type: 'CAPTURE',
	amount: '40',
	currency: 'USD',
	referenceType: 'PAYMENT_CAPTURE',
	referenceId: 'capture-1',
	paymentId: 'payment-1',
	...overrides
});

describe('OrderPaymentLedgerService (Q7-W1b)', () => {
	it('writes a capture onto the order ledger, re-derives the order and lets it complete', async () => {
		const { ledger, rows, totalsService, orderService } = fixture();

		const answer = await ledger.record(fact());

		expect(answer).toEqual({ recorded: true, transactionId: 'tx-1' });
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			orderId: ORDER.id,
			type: OrderTransactionType.CAPTURE,
			amount: '40',
			currency: 'USD',
			referenceType: 'PAYMENT_CAPTURE',
			referenceId: 'capture-1',
			tenantId: ORDER.tenantId,
			organizationId: ORDER.organizationId,
			metadata: { source: 'payment', paymentId: 'payment-1' }
		});
		expect(totalsService.recompute).toHaveBeenCalledWith(ORDER.id, 'PAYMENT_RECORDED');
		expect(orderService.completeIfSettled).toHaveBeenCalledWith(ORDER.id);
	});

	it('writes one fact once, however often it is reported', async () => {
		const { ledger, rows, totalsService } = fixture();

		await ledger.record(fact());
		const again = await ledger.record(fact());

		expect(again).toEqual({ recorded: false, transactionId: 'tx-1' });
		expect(rows).toHaveLength(1);
		expect(totalsService.recompute).toHaveBeenCalledTimes(1);
	});

	it('keeps an authorisation and a void of the same payment apart: the type is part of the key', async () => {
		const { ledger, rows } = fixture();

		await ledger.record(fact({ type: 'AUTHORIZATION', referenceType: 'PAYMENT', referenceId: 'payment-1' }));
		await ledger.record(fact({ type: 'VOID', referenceType: 'PAYMENT', referenceId: 'payment-1' }));

		expect(rows.map((row) => row.type)).toEqual([OrderTransactionType.AUTHORIZATION, OrderTransactionType.VOID]);
		expect(rows.every((row) => row.amount === '40')).toBe(true);
	});

	it('writes a refund as the negative row the ledger counts money given back as', async () => {
		const { ledger, rows } = fixture();

		await ledger.record(fact({ type: 'REFUND', referenceType: 'REFUND', referenceId: 'refund-1', amount: '15.5' }));

		expect(rows[0]).toMatchObject({ type: OrderTransactionType.REFUND, amount: '-15.5' });
	});

	it('refuses a fact in another currency than the order, and writes nothing', async () => {
		const { ledger, rows } = fixture();

		await expect(ledger.record(fact({ currency: 'EUR' }))).rejects.toThrow(/ORDER_TRANSACTION_CURRENCY_MISMATCH/);
		expect(rows).toHaveLength(0);
	});

	it('refuses an amount that is not a positive exact decimal', async () => {
		const { ledger } = fixture();

		await expect(ledger.record(fact({ amount: '0' }))).rejects.toThrow(/ORDER_TRANSACTION_AMOUNT_INVALID/);
		await expect(ledger.record(fact({ amount: '-4' }))).rejects.toThrow(/ORDER_TRANSACTION_AMOUNT_INVALID/);
		await expect(ledger.record(fact({ amount: 'forty' }))).rejects.toThrow(/ORDER_TRANSACTION_AMOUNT_INVALID/);
	});

	it('refuses a fact about an order outside the caller tenant', async () => {
		const { ledger } = fixture();

		await expect(ledger.record(fact({ orderId: 'order-elsewhere' }))).rejects.toThrow(/ORDER_NOT_FOUND/);
	});

	it('keeps the recorded money when the completion that follows it fails', async () => {
		const { ledger, rows } = fixture({ completeFails: true });

		await expect(ledger.record(fact())).resolves.toMatchObject({ recorded: true });
		expect(rows).toHaveLength(1);
	});

	it('records the facts a checkout carried in one by one, a refused one not stopping the rest', async () => {
		const { ledger, rows } = fixture();

		const recorded = await ledger.recordAll([
			fact({ type: 'AUTHORIZATION', referenceType: 'PAYMENT', referenceId: 'payment-1' }),
			fact({ currency: 'EUR', referenceId: 'capture-eur' }),
			fact()
		]);

		expect(recorded).toBe(2);
		expect(rows.map((row) => row.referenceId)).toEqual(['payment-1', 'capture-1']);
	});
});
