/**
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry — none of which a totals function needs, and none of which is available outside a running
 * application. The seam is therefore doubled at the module boundary, with the *real* `Money` value
 * object loaded from its own module so that the arithmetic under test is the platform's.
 */
jest.mock('@gauzy/core', () => ({
	Money: jest.requireActual('@gauzy/core/src/lib/money/money').Money
}));

import { CurrencyCode, RoundingMode } from '@gauzy/contracts';
import { Money } from '@gauzy/core/src/lib/money/money';
import { ITotalsAdjustment, ITotalsContext, ITotalsLine, ITotalsTaxLine, TotalsCalculator } from './totals-calculator';

/**
 * The one totals function of the platform.
 *
 * `TotalsCalculator.compute` is applied identically to a cart and to the order that cart becomes, so
 * an error here is an error on every document that carries a totals snapshot — and it is an error
 * that a reconciliation job would have to find, because the stored columns would simply agree with
 * each other and be wrong together.
 *
 * The suite pins the properties the specification states rather than the numbers this implementation
 * happens to return:
 *
 * - the rounding boundary sits at the line, not at the unit (doc 07 §3.4 E1: line-first and
 *   unit-first differ by a cent at `quantity = 3`);
 * - a tax-inclusive price is normalised to net and tax added back, so the grand total is identical
 *   whether the catalogue is priced inclusive or exclusive (doc 07 §4.5);
 * - `grandTotal` is the *exact* sum of already-rounded components and is never itself a rounding of a
 *   float (`I1`, `I7`, `I12`);
 * - the order-only tail derives `paidTotal`, `refundedTotal` and `outstandingTotal` from the ledger,
 *   with an `AUTHORIZATION` counting for nothing (doc 07 §6.1 step 11–14).
 *
 * Two cases are **controls**: they assert the value the naive implementation produces *as well as*
 * the value the implementation must produce, so the suite cannot pass by asserting whatever the code
 * happens to do. Both are marked in place.
 */

const USD: CurrencyCode = 'USD';
const JPY: CurrencyCode = 'JPY';

/** A line as the totals chain sees it. */
const line = (id: string, quantity: number, unitPrice: number, isTaxInclusive = false): ITotalsLine => ({
	id,
	quantity,
	unitPrice,
	isTaxInclusive
});

/** A tax line owned by a line or a shipping method. */
const taxLine = (ownerId: string, amount: number): ITotalsTaxLine => ({ ownerId, amount });

/** A signed ledger row. */
const adjustment = (
	ownerId: string,
	amount: number,
	extra: Partial<ITotalsAdjustment> = {}
): ITotalsAdjustment => ({
	ownerId,
	amount,
	isTaxInclusive: false,
	...extra
});

/** The smallest context that computes: one currency and nothing else. */
const context = (overrides: Partial<ITotalsContext> = {}): ITotalsContext => ({
	currency: USD,
	currencyDecimals: 2,
	lines: [],
	shippingMethods: [],
	lineAdjustments: [],
	shippingAdjustments: [],
	lineTaxLines: [],
	shippingTaxLines: [],
	...overrides
});

describe('TotalsCalculator', () => {
	it('totals a single exclusive line exactly', () => {
		const totals = TotalsCalculator.compute(context({ lines: [line('L1', 2, 19.99)] }));

		expect(totals.itemSubtotal).toBe(39.98);
		expect(totals.discountTotal).toBe(0);
		expect(totals.taxTotal).toBe(0);
		expect(totals.grandTotal).toBe(39.98);
		expect(totals.currency).toBe(USD);
		expect(totals.currencyDecimals).toBe(2);
	});

	it('rounds tax on the line subtotal, not on the unit price', () => {
		// Doc 07 §3.4 E1. `24.99 x 3 = 74.97`; twenty percent of that is `14.994`, which at two
		// decimals is `14.99`. Rounding the per-unit tax first gives `3 x 5.00 = 15.00` and a grand
		// total one cent higher, and that is what the second expectation pins as the wrong answer.
		const lineTax = 14.99;
		const totals = TotalsCalculator.compute(
			context({ lines: [line('L1', 3, 24.99)], lineTaxLines: [taxLine('L1', lineTax)] })
		);

		expect(totals.itemSubtotal).toBe(74.97);
		expect(totals.taxTotal).toBe(14.99);
		expect(totals.grandTotal).toBe(89.96);

		// Control: the unit-first accumulation the platform forbids.
		const unitFirstTax = 3 * Math.round(24.99 * 0.2 * 100) / 100;
		expect(unitFirstTax).toBe(15);
		expect(totals.taxTotal).not.toBe(unitFirstTax);
	});

	it('extracts the tax of an inclusive line so the same gross totals the same either way', () => {
		const inclusive = TotalsCalculator.compute(
			context({ lines: [line('L1', 1, 12, true)], lineTaxLines: [taxLine('L1', 2)] })
		);
		const exclusive = TotalsCalculator.compute(
			context({ lines: [line('L1', 1, 10)], lineTaxLines: [taxLine('L1', 2)] })
		);

		// The inclusive line's gross is 12.00 and its tax line is 2.00, so its net base is 10.00.
		expect(inclusive.itemSubtotal).toBe(10);
		expect(inclusive.taxTotal).toBe(2);
		expect(inclusive.grandTotal).toBe(12);
		// The two presentations of the same sale must not disagree.
		expect(inclusive.grandTotal).toBe(exclusive.grandTotal);
		expect(inclusive.itemSubtotal).toBe(exclusive.itemSubtotal);
		expect(inclusive.taxTotal).toBe(exclusive.taxTotal);
	});

	it('adds an exact sum of already-rounded line subtotals', () => {
		// Control: binary floating point cannot hold these values, so ten lines of `0.07` summed as
		// doubles give `0.7000000000000001`. A total stored from that accumulation is a wrong cent
		// waiting for the next rounding boundary.
		const lines = Array.from({ length: 10 }, (_, index) => line(`L${index}`, 1, 0.07));
		const totals = TotalsCalculator.compute(context({ lines }));

		expect(totals.itemSubtotal).toBe(0.7);
		expect(totals.grandTotal).toBe(0.7);

		const naive = lines.reduce((sum, each) => sum + 0.07 * each.quantity, 0);
		expect(naive).not.toBe(0.7);
	});

	it('is idempotent: recomputing the same context returns the same totals', () => {
		const given = context({
			lines: [line('L1', 3, 24.99), line('L2', 1, 5)],
			lineTaxLines: [taxLine('L1', 14.99), taxLine('L2', 0.36)],
			lineAdjustments: [adjustment('L1', -3.998)]
		});

		expect(TotalsCalculator.compute(given)).toEqual(TotalsCalculator.compute(given));
	});

	it('does not depend on the order the lines arrive in', () => {
		const lines = [line('L1', 3, 24.99), line('L2', 1, 5), line('L3', 2, 0.07)];
		const taxLines = [taxLine('L1', 14.99), taxLine('L2', 0.36), taxLine('L3', 0.01)];
		const adjustments = [adjustment('L1', -3.998), adjustment('L2', -1), adjustment('L3', -0.02)];

		const forward = TotalsCalculator.compute(
			context({ lines, lineTaxLines: taxLines, lineAdjustments: adjustments })
		);
		const reversed = TotalsCalculator.compute(
			context({
				lines: [...lines].reverse(),
				lineTaxLines: [...taxLines].reverse(),
				lineAdjustments: [...adjustments].reverse()
			})
		);

		expect(reversed.grandTotal).toBe(forward.grandTotal);
		expect(reversed.taxTotal).toBe(forward.taxTotal);
		expect(reversed.discountTotal).toBe(forward.discountTotal);
	});

	it('allocates a whole discount across lines so the parts sum back to the whole', () => {
		// `I12`: the sum of the allocated parts is the whole, always. Three lines carrying weights
		// that do not divide evenly are the case where an independent `round(whole * share)` per line
		// loses a minor unit.
		const weights = [33.33, 33.33, 33.34];
		const parts = Money.of(10, USD, 2).allocate(weights);

		expect(parts.map((part) => Number(part.toStorageString()))).toEqual([3.33, 3.33, 3.34]);
		expect(Money.sum(parts, USD, 2).equals(Money.of(10, USD, 2))).toBe(true);

		// Independent per-line rounding of the same weights does NOT sum to the whole — the defect
		// the largest-remainder allocation exists to prevent.
		const share = (weight: number) => Math.round(10 * (weight / 100) * 100) / 100;
		const independent = weights.map(share);
		expect(independent).toEqual([3.33, 3.33, 3.33]);
		expect(independent.reduce((sum, part) => sum + part, 0)).not.toBe(10);

		const lines = [line('L1', 1, 33.33), line('L2', 1, 33.33), line('L3', 1, 33.34)];
		const totals = TotalsCalculator.compute(
			context({
				lines,
				lineAdjustments: parts.map((part, index) =>
					adjustment(`L${index + 1}`, -Number(part.toStorageString()))
				)
			})
		);

		expect(totals.itemSubtotal).toBe(100);
		expect(totals.discountTotal).toBe(10);
		expect(totals.grandTotal).toBe(90);
	});

	it('ignores a ledger row whose owner is not one of the lines', () => {
		const totals = TotalsCalculator.compute(
			context({
				lines: [line('L1', 1, 20)],
				// A discount that names a line this document does not have — a stale row, or a row
				// written against another aggregate — must not silently reduce this total.
				lineAdjustments: [adjustment('L-OTHER', -5)]
			})
		);

		expect(totals.discountTotal).toBe(0);
		expect(totals.grandTotal).toBe(20);
	});

	it('counts only negative ledger rows as a discount', () => {
		const totals = TotalsCalculator.compute(
			context({
				lines: [line('L1', 1, 20)],
				// A fee is a positive adjustment. Taking `|sum|` would report it as a discount and
				// subtract it from the total instead of adding it.
				lineAdjustments: [adjustment('L1', 2.5)]
			})
		);

		expect(totals.itemDiscountTotal).toBe(0);
		expect(totals.discountTotal).toBe(0);
		// The chain has no term for a line fee on its own, so the total is unchanged; what matters
		// here is that the fee was not booked as a discount.
		expect(totals.grandTotal).toBe(20);
	});

	it('uses the net part an inclusive adjustment carries rather than its gross', () => {
		// Doc 07 §5.4: a gross discount on an inclusive line reduces the taxable base by its net
		// part. Using the gross here is the documented one-cent mismatch.
		const totals = TotalsCalculator.compute(
			context({
				lines: [line('L1', 1, 12, true)],
				lineTaxLines: [taxLine('L1', 2)],
				lineAdjustments: [adjustment('L1', -1.2, { isTaxInclusive: true, netAmount: 1 })]
			})
		);

		expect(totals.itemSubtotal).toBe(10);
		expect(totals.itemDiscountTotal).toBe(1);
		expect(totals.taxTotal).toBe(2);
		expect(totals.grandTotal).toBe(11);
	});

	it('normalises an inclusive shipping method and taxes it separately from the goods', () => {
		const totals = TotalsCalculator.compute(
			context({
				lines: [line('L1', 1, 10)],
				lineTaxLines: [taxLine('L1', 2)],
				shippingMethods: [{ id: 'S1', amount: 6, isTaxInclusive: true }],
				shippingTaxLines: [taxLine('S1', 1)]
			})
		);

		expect(totals.shippingSubtotal).toBe(5);
		expect(totals.shippingTaxTotal).toBe(1);
		// `taxTotal` is the item tax only; shipping tax is its own column, which is what makes the
		// grand-total formula hold with both terms present (doc 07 §6.1).
		expect(totals.taxTotal).toBe(2);
		expect(totals.grandTotal).toBe(18);
	});

	it('applies a shipping-scoped discount to shipping, and one whose owner is the cart as well', () => {
		const totals = TotalsCalculator.compute(
			context({
				lines: [line('L1', 1, 10)],
				shippingMethods: [
					{ id: 'S1', amount: 5, isTaxInclusive: false },
					{ id: 'S2', amount: 3, isTaxInclusive: false }
				],
				shippingAdjustments: [adjustment('S1', -1), adjustment('S1', -0.5), adjustment('S2', -0.5)]
			})
		);

		expect(totals.shippingSubtotal).toBe(8);
		expect(totals.shippingDiscountTotal).toBe(2);
		expect(totals.itemDiscountTotal).toBe(0);
		expect(totals.discountTotal).toBe(2);
		expect(totals.grandTotal).toBe(16);
	});

	it('rounds a half minor unit away from zero at the line boundary', () => {
		// The boundary rule of doc 07 §3.1. `Math.round(1.005 * 100) / 100` returns `1`, because
		// `1.005` is not exactly representable and the product lands just below the half — the naive
		// implementation is asserted here so this case cannot pass for the wrong reason.
		const totals = TotalsCalculator.compute(context({ lines: [line('L1', 1, 1.005)] }));

		expect(totals.itemSubtotal).toBe(1.01);
		expect(Math.round(1.005 * 100) / 100).toBe(1);
	});

	it('rounds a fractional quantity at the same boundary', () => {
		// `19.99 x 1.5 = 29.985`, an exact half at two decimals, so it rounds up to `29.99`.
		const totals = TotalsCalculator.compute(context({ lines: [line('L1', 1.5, 19.99)] }));

		expect(totals.itemSubtotal).toBe(29.99);
		expect(Math.floor(19.99 * 1.5 * 100) / 100).toBe(29.98);
	});

	it('lands on whole units for a zero-decimal currency', () => {
		const totals = TotalsCalculator.compute(
			context({
				currency: JPY,
				currencyDecimals: 0,
				lines: [line('L1', 3, 33.5)],
				lineTaxLines: [taxLine('L1', 10.5)]
			})
		);

		// `33.5 x 3 = 100.5` and `10.5` both sit on an exact half of the minor unit and round up.
		expect(totals.itemSubtotal).toBe(101);
		expect(totals.taxTotal).toBe(11);
		expect(totals.grandTotal).toBe(112);
		expect(Number.isInteger(totals.itemSubtotal)).toBe(true);
		expect(Number.isInteger(totals.taxTotal)).toBe(true);
	});

	it('derives the order tail from the money ledger', () => {
		const totals = TotalsCalculator.compute(
			context({
				lines: [line('L1', 1, 100)],
				creditLines: [10],
				transactions: [
					{ amount: 100, type: 'AUTHORIZATION' },
					{ amount: 60, type: 'CAPTURE' },
					{ amount: -15, type: 'REFUND' }
				]
			})
		);

		expect(totals.grandTotal).toBe(100);
		expect(totals.creditTotal).toBe(10);
		// An authorisation is not money received, so it is absent from `paidTotal`.
		expect(totals.paidTotal).toBe(60);
		expect(totals.refundedTotal).toBe(15);
		// `grandTotal - creditTotal - paidTotal + refundedTotal`.
		expect(totals.outstandingTotal).toBe(45);
	});

	it('reports an overpaid order as a negative outstanding amount rather than clamping it', () => {
		const totals = TotalsCalculator.compute(
			context({
				lines: [line('L1', 1, 20)],
				transactions: [{ amount: 25, type: 'CAPTURE' }]
			})
		);

		expect(totals.paidTotal).toBe(25);
		expect(totals.outstandingTotal).toBe(-5);
	});

	it('omits the order tail entirely for a document that carries neither credits nor a ledger', () => {
		const totals = TotalsCalculator.compute(context({ lines: [line('L1', 1, 20)] }));

		expect(totals.creditTotal).toBeUndefined();
		expect(totals.paidTotal).toBeUndefined();
		expect(totals.refundedTotal).toBeUndefined();
		expect(totals.outstandingTotal).toBeUndefined();
	});

	it('refuses a snapshot whose components do not add up to the grand total', () => {
		const settled = TotalsCalculator.compute(context({ lines: [line('L1', 1, 20)] }));

		expect(() =>
			TotalsCalculator.assertSettled({ ...settled, grandTotal: settled.grandTotal + 0.01 }, USD, 2)
		).toThrow(/TOTALS_NOT_SETTLED/);
		expect(() =>
			TotalsCalculator.assertSettled({ ...settled, discountTotal: 0.01 }, USD, 2)
		).toThrow(/TOTALS_NOT_SETTLED/);
		expect(() => TotalsCalculator.assertSettled({ ...settled, taxTotal: 0.01 }, USD, 2)).toThrow(
			/TOTALS_NOT_SETTLED/
		);
		expect(TotalsCalculator.assertSettled(settled, USD, 2)).toBe(settled);
	});

	it('refuses a ledger row that has not crossed its own boundary', () => {
		// Every `adjustment` and `tax_line` amount was rounded at B3/B4 when it was written, so a
		// sub-minor-unit row means a writer stored a value it had not settled. The chain refuses it —
		// `grandTotal` is computed from the working value while the stored components are rounded, so
		// the two disagree and `assertSettled` says so. Silently rounding the row instead would make
		// the ledger and the total disagree without anyone noticing.
		expect(() =>
			TotalsCalculator.compute(
				context({ lines: [line('L1', 1, 20)], lineAdjustments: [adjustment('L1', -0.005)] })
			)
		).toThrow(/TOTALS_NOT_SETTLED/);

		// The same discount, settled at the currency's scale, is accepted.
		const settled = TotalsCalculator.compute(
			context({ lines: [line('L1', 1, 20)], lineAdjustments: [adjustment('L1', -0.01)] })
		);

		expect(settled.discountTotal).toBe(0.01);
		expect(settled.grandTotal).toBe(19.99);
	});

	it('leaves every stored total exact at the currency scale', () => {
		// `I7`: a stored total is already rounded, so reading it back at the currency's scale may not
		// lose anything. `Money.toMinorUnits` is the assertion: it throws `MONEY_SCALE_LOSS` on a
		// value that still carries a digit below the scale, which is exactly a total that has not
		// crossed its boundary.
		const totals = TotalsCalculator.compute(
			context({
				lines: [line('L1', 1, 3.345), line('L2', 3, 1.005)],
				lineTaxLines: [taxLine('L1', 0.5)],
				lineAdjustments: [adjustment('L1', -0.01)]
			})
		);
		const columns = [
			totals.itemSubtotal,
			totals.itemDiscountTotal,
			totals.itemTaxTotal,
			totals.shippingSubtotal,
			totals.shippingDiscountTotal,
			totals.shippingTaxTotal,
			totals.discountTotal,
			totals.taxTotal,
			totals.grandTotal
		];

		expect(totals.itemSubtotal).toBe(6.37);
		expect(totals.grandTotal).toBe(6.86);

		for (const column of columns) {
			expect(() => Money.of(column, USD, 2).toMinorUnits()).not.toThrow();
		}

		// Control: the same read of a value that has not crossed the boundary is refused.
		expect(() => Money.of(39.985, USD, 2).toMinorUnits()).toThrow(/MONEY_SCALE_LOSS/);
	});

	it('rounds half up under the mode the chain names', () => {
		// The chain rounds at every boundary with `HALF_UP`; a value at an exact half is the only
		// input that distinguishes it from `HALF_EVEN`, and `3.345` is such a value.
		const totals = TotalsCalculator.compute(context({ lines: [line('L1', 1, 3.345)] }));

		expect(totals.itemSubtotal).toBe(3.35);
		expect(
			Money.of(3.345, USD, 2).round(RoundingMode.HALF_EVEN, 2).toStorageString()
		).toBe('3.340000');
	});
});
