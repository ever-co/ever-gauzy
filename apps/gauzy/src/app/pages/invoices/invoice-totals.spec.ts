import { DiscountTaxTypeEnum, TaxCalculationTypeEnum } from '@gauzy/contracts';
import { calculateInvoiceTotals, IInvoiceTotalsInput } from './invoice-totals';

const { PERCENT, FLAT_VALUE } = DiscountTaxTypeEnum;
const { SIMPLE, COMPOSED } = TaxCalculationTypeEnum;

/** Two taxable items, 100 and 200: subtotal 300. */
function input(overrides: Partial<IInvoiceTotalsInput> = {}): IInvoiceTotalsInput {
	const items = overrides.items ?? [
		{ totalValue: 100, applyTax: true, applyDiscount: true },
		{ totalValue: 200, applyTax: true, applyDiscount: true }
	];
	return {
		subtotal: items.reduce((sum, item) => sum + +item.totalValue, 0),
		tax: 10,
		taxType: PERCENT,
		tax2: 5,
		tax2Type: PERCENT,
		taxCalculationType: SIMPLE,
		discountValue: 0,
		discountType: null,
		discountAfterTax: false,
		...overrides,
		items
	};
}

describe('calculateInvoiceTotals', () => {
	describe('compound (COMPOSED) tax', () => {
		it("applies the second tax to each item's amount plus that item's first tax only", () => {
			// 100: 10 + 5% of 110 = 15.5;  200: 20 + 5% of 220 = 31;  tax 46.5
			const { totalTax, total } = calculateInvoiceTotals(input({ taxCalculationType: COMPOSED }));

			expect(totalTax).toBeCloseTo(46.5, 10);
			expect(total).toBeCloseTo(346.5, 10);
		});

		it('gives the same tax as computing each item on an invoice of its own', () => {
			const items = [
				{ totalValue: 100, applyTax: true },
				{ totalValue: 200, applyTax: true },
				{ totalValue: 50, applyTax: true }
			];
			const together = calculateInvoiceTotals(input({ items, taxCalculationType: COMPOSED })).totalTax;
			const separately = items
				.map((item) => calculateInvoiceTotals(input({ items: [item], taxCalculationType: COMPOSED })).totalTax)
				.reduce((sum, tax) => sum + tax, 0);

			expect(together).toBeCloseTo(separately, 10);
		});

		it('compounds on a flat first tax per item', () => {
			// each item: 10 flat + 5% of (amount + 10):  100 -> 10 + 5.5;  200 -> 10 + 10.5;  tax 36
			const { totalTax } = calculateInvoiceTotals(
				input({ taxType: FLAT_VALUE, tax: 10, taxCalculationType: COMPOSED })
			);

			expect(totalTax).toBeCloseTo(36, 10);
		});

		it('is the second tax alone on the item amount when the first tax type is unset', () => {
			const { totalTax } = calculateInvoiceTotals(input({ taxType: null, taxCalculationType: COMPOSED }));

			expect(totalTax).toBeCloseTo(15, 10);
		});
	});

	describe('simple (SIMPLE) tax', () => {
		it('applies both taxes to the item amount', () => {
			// 10% + 5% of 300
			const { totalTax, total } = calculateInvoiceTotals(input());

			expect(totalTax).toBeCloseTo(45, 10);
			expect(total).toBeCloseTo(345, 10);
		});

		it('is simple when no calculation type is given (the edit page)', () => {
			const { totalTax } = calculateInvoiceTotals(input({ taxCalculationType: undefined }));

			expect(totalTax).toBeCloseTo(45, 10);
		});

		it('adds a flat tax once per taxable item', () => {
			const { totalTax } = calculateInvoiceTotals(input({ taxType: FLAT_VALUE, tax: 10, tax2Type: null }));

			expect(totalTax).toBeCloseTo(20, 10);
		});
	});

	describe('an unset tax type (#10408)', () => {
		it('keeps the first tax when the second tax type is unset', () => {
			const { totalTax } = calculateInvoiceTotals(input({ tax2Type: null }));

			expect(totalTax).toBeCloseTo(30, 10);
		});

		it('keeps the second tax when the first tax type is unset', () => {
			const { totalTax } = calculateInvoiceTotals(input({ taxType: null }));

			expect(totalTax).toBeCloseTo(15, 10);
		});
	});

	it('taxes only the items that apply tax', () => {
		const items = [
			{ totalValue: 100, applyTax: true },
			{ totalValue: 200, applyTax: false }
		];
		const { totalTax, total } = calculateInvoiceTotals(input({ items, taxCalculationType: COMPOSED }));

		expect(totalTax).toBeCloseTo(15.5, 10);
		expect(total).toBeCloseTo(315.5, 10);
	});

	it('reads numeric strings as numbers rather than concatenating them', () => {
		const items = [{ totalValue: '100' as unknown as number, applyTax: true }];
		const { totalTax } = calculateInvoiceTotals(
			input({
				items,
				tax: '10' as unknown as number,
				tax2: '5' as unknown as number,
				taxCalculationType: COMPOSED
			})
		);

		expect(totalTax).toBeCloseTo(15.5, 10);
	});

	describe('discount', () => {
		it('takes a percentage off each discounted item before tax', () => {
			const { totalDiscount, total } = calculateInvoiceTotals(
				input({ discountType: PERCENT, discountValue: 10, tax2Type: null })
			);

			// 10% of 300 = 30; tax 10% of 300 = 30
			expect(totalDiscount).toBeCloseTo(30, 10);
			expect(total).toBeCloseTo(300, 10);
		});

		it('takes a percentage of subtotal plus tax when the discount comes after tax', () => {
			const { totalDiscount } = calculateInvoiceTotals(
				input({ discountType: PERCENT, discountValue: 10, tax2Type: null, discountAfterTax: true })
			);

			// 10% of (300 + 30)
			expect(totalDiscount).toBeCloseTo(33, 10);
		});

		it('takes a flat discount once per discounted item', () => {
			const { totalDiscount } = calculateInvoiceTotals(input({ discountType: FLAT_VALUE, discountValue: 5 }));

			expect(totalDiscount).toBeCloseTo(10, 10);
		});

		it('never makes the total negative', () => {
			const { total } = calculateInvoiceTotals(
				input({ discountType: FLAT_VALUE, discountValue: 1000, taxType: null, tax2Type: null })
			);

			expect(total).toBe(0);
		});
	});

	it('ignores negative tax and discount values', () => {
		const { totalTax, totalDiscount } = calculateInvoiceTotals(
			input({ tax: -10, tax2: -5, discountType: PERCENT, discountValue: -10 })
		);

		expect(totalTax).toBe(0);
		expect(totalDiscount).toBe(0);
	});
});
