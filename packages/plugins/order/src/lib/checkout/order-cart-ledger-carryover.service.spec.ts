/**
 * Q7-W1a — a cart's discount and tax rows travel onto the order it became.
 *
 * `@gauzy/core` is doubled at the module boundary (its barrel boots the whole application graph); the two
 * ledger services are replaced by one in-memory ledger that both reads and appends, so the suite asserts
 * what the order's owners hold afterwards rather than which calls were made.
 */
jest.mock('@gauzy/core', () => ({
	AdjustmentService: class {},
	TaxLineService: class {},
	Money: jest.requireActual('@gauzy/core/src/lib/money/money').Money
}));

import { AdjustmentOwnerType, AdjustmentType, TaxLineOwnerType } from '@gauzy/contracts';
import { OrderCartLedgerCarryover } from './order-cart-ledger-carryover.service';

/** One in-memory ledger table with the two calls the carry-over makes. */
function ledger(seed: any[]) {
	const rows = [...seed];

	return {
		rows,
		findByOwner: jest.fn(async (ownerType: string, ownerId: string) =>
			rows.filter((row) => row.ownerType === ownerType && row.ownerId === ownerId)
		),
		append: jest.fn(async (input: any) => {
			const row = { id: `${input.ownerType}-${rows.length + 1}`, ...input };
			rows.push(row);

			return row;
		})
	};
}

function fixture() {
	const adjustments = ledger([
		{
			id: 'adj-line',
			ownerType: AdjustmentOwnerType.CART_LINE,
			ownerId: 'cart-line-1',
			amount: '-4.000000',
			currency: 'USD',
			isTaxInclusive: false,
			type: AdjustmentType.PROMOTION,
			code: 'SPRING',
			referenceType: 'promotion',
			referenceId: 'promotion-1',
			metadata: { cartPromotionId: 'cart-promotion-1' }
		},
		{
			id: 'adj-shipping',
			ownerType: AdjustmentOwnerType.CART_SHIPPING,
			ownerId: 'cart-shipping-1',
			amount: '-1.000000',
			currency: 'USD',
			isTaxInclusive: false,
			type: AdjustmentType.PROMOTION
		},
		{
			id: 'adj-document',
			ownerType: AdjustmentOwnerType.CART,
			ownerId: 'cart-1',
			amount: '-2.000000',
			currency: 'USD',
			isTaxInclusive: false,
			type: AdjustmentType.PROMOTION
		},
		// A row of a line the order did not take: never guessed onto another owner.
		{
			id: 'adj-orphan',
			ownerType: AdjustmentOwnerType.CART_LINE,
			ownerId: 'cart-line-gone',
			amount: '-9.000000',
			currency: 'USD',
			isTaxInclusive: false,
			type: AdjustmentType.PROMOTION
		}
	]);
	const taxLines = ledger([
		{
			id: 'tax-line',
			ownerType: TaxLineOwnerType.CART_LINE,
			ownerId: 'cart-line-1',
			taxRateId: 'rate-1',
			code: 'VAT',
			name: 'VAT',
			rate: '0.100000',
			isCompound: false,
			isInclusive: false,
			baseAmount: '36.000000',
			amount: '3.600000',
			currency: 'USD'
		},
		{
			id: 'tax-shipping',
			ownerType: TaxLineOwnerType.CART_SHIPPING,
			ownerId: 'cart-shipping-1',
			name: 'VAT',
			rate: '0.100000',
			isCompound: false,
			isInclusive: false,
			baseAmount: '4.000000',
			amount: '0.400000',
			currency: 'USD'
		}
	]);
	const carryover = new OrderCartLedgerCarryover(adjustments as never, taxLines as never);

	return { adjustments, taxLines, carryover };
}

const ROWS = {
	lines: new Map([['cart-line-1', 'order-line-1']]),
	shippingMethods: new Map([['cart-shipping-1', 'order-shipping-1']])
};

describe('OrderCartLedgerCarryover (Q7-W1a)', () => {
	it('moves every cart line and shipping adjustment onto its order counterpart', async () => {
		const { adjustments, carryover } = fixture();

		const result = await carryover.carry('cart-1', 'order-1', ROWS);

		const copied = adjustments.rows.filter((row) => String(row.ownerType).startsWith('ORDER'));

		expect(result.adjustments).toBe(3);
		expect(copied.map((row) => [row.ownerType, row.ownerId, Number(row.amount)])).toEqual([
			[AdjustmentOwnerType.ORDER_LINE, 'order-line-1', -4],
			[AdjustmentOwnerType.ORDER_SHIPPING, 'order-shipping-1', -1],
			// The document-level row, spread over the order's one line.
			[AdjustmentOwnerType.ORDER_LINE, 'order-line-1', -2]
		]);
		// Nothing is owned by the order as a whole: its per-line breakdown bills lines and delivery choices.
		expect(copied.some((row) => row.ownerType === AdjustmentOwnerType.ORDER)).toBe(false);
	});

	it('spreads a document-level row over the lines by their value, exactly', async () => {
		const { adjustments, carryover } = fixture();

		await carryover.carry('cart-1', 'order-1', {
			lines: new Map([
				['cart-line-1', 'order-line-1'],
				['cart-line-2', 'order-line-2'],
				['cart-line-3', 'order-line-3']
			]),
			shippingMethods: new Map(),
			lineWeights: new Map([
				['order-line-1', '40'],
				['order-line-2', '10'],
				['order-line-3', '0']
			]),
			currencyDecimals: 2
		});

		const shares = adjustments.rows.filter(
			(row) => row.metadata?.carriedFrom?.ownerType === AdjustmentOwnerType.CART
		);

		expect(shares.map((row) => [row.ownerId, Number(row.amount)])).toEqual([
			['order-line-1', -1.6],
			['order-line-2', -0.4]
		]);
		expect(shares[0].metadata.carriedFrom).toEqual({
			ownerType: AdjustmentOwnerType.CART,
			ownerId: 'cart-1',
			adjustmentId: 'adj-document',
			allocatedTo: 'order-line-1'
		});
	});

	it('keeps what produced the discount and records where the copy came from', async () => {
		const { adjustments, carryover } = fixture();

		await carryover.carry('cart-1', 'order-1', ROWS);

		const line = adjustments.rows.find((row) => row.ownerType === AdjustmentOwnerType.ORDER_LINE);

		expect(line).toMatchObject({
			type: AdjustmentType.PROMOTION,
			code: 'SPRING',
			referenceType: 'promotion',
			referenceId: 'promotion-1',
			currency: 'USD',
			isTaxInclusive: false
		});
		expect(line.metadata).toEqual({
			cartPromotionId: 'cart-promotion-1',
			carriedFrom: { ownerType: AdjustmentOwnerType.CART_LINE, ownerId: 'cart-line-1', adjustmentId: 'adj-line' }
		});
	});

	it('moves the tax breakdown of each line and shipping method, rate by rate', async () => {
		const { taxLines, carryover } = fixture();

		const result = await carryover.carry('cart-1', 'order-1', ROWS);

		const copied = taxLines.rows.filter((row) => String(row.ownerType).startsWith('ORDER'));

		expect(result.taxLines).toBe(2);
		expect(copied.map((row) => [row.ownerType, row.ownerId, row.amount, row.rate, row.baseAmount])).toEqual([
			[TaxLineOwnerType.ORDER_LINE, 'order-line-1', '3.600000', '0.100000', '36.000000'],
			[TaxLineOwnerType.ORDER_SHIPPING, 'order-shipping-1', '0.400000', '0.100000', '4.000000']
		]);
		expect(copied[0]).toMatchObject({ taxRateId: 'rate-1', code: 'VAT', name: 'VAT' });
		expect(copied[0].metadata.carriedFrom).toEqual({
			ownerType: TaxLineOwnerType.CART_LINE,
			ownerId: 'cart-line-1',
			taxLineId: 'tax-line'
		});
	});

	it('never moves a row whose cart owner did not become an order row', async () => {
		const { adjustments, carryover } = fixture();

		await carryover.carry('cart-1', 'order-1', ROWS);

		expect(adjustments.rows.filter((row) => row.amount === '-9.000000')).toHaveLength(1);
		expect(adjustments.findByOwner).not.toHaveBeenCalledWith(AdjustmentOwnerType.CART_LINE, 'cart-line-gone');
	});

	it('lets a refused copy propagate, so the caller can cancel the draft instead of placing it', async () => {
		const { adjustments, carryover } = fixture();
		adjustments.append.mockRejectedValueOnce(new Error('ADJUSTMENT_SIGN_MISMATCH'));

		await expect(carryover.carry('cart-1', 'order-1', ROWS)).rejects.toThrow(/ADJUSTMENT_SIGN_MISMATCH/);
	});
});
