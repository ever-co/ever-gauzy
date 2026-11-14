import {
	billRateOf,
	budgetNeedsDefaultRate,
	defaultBillRateOf,
	DefaultBillRate,
	hasOwnBillRate,
	pricesAtDefault
} from './default-bill-rate';

/**
 * Issue #11919: the organization's default billing rate is the last link of the price chain. It prices the time of a
 * member without a rate of their own, never replaces a rate that exists, and an organization without a default
 * prices everything as before.
 */
describe('default billing rate', () => {
	const EIGHTY_EUR: DefaultBillRate = { value: 80, currency: 'EUR' };

	describe('hasOwnBillRate', () => {
		it.each([
			['a rate of 60', 60, true],
			['a numeric column read as text', '12.50', true],
			['the 0 a member is stored with when nobody set a rate', 0, false],
			['a rate read as text 0.00', '0.00', false],
			['no rate', null, false],
			['an unread rate', undefined, false]
		])('%s', (_name, billRateValue, expected) => {
			expect(hasOwnBillRate({ billRateValue: billRateValue as number })).toBe(expected);
		});

		it('is false without a member', () => {
			expect(hasOwnBillRate(null)).toBe(false);
		});
	});

	describe('defaultBillRateOf', () => {
		it('is null for an organization that sets none, or one that is not positive', () => {
			expect(defaultBillRateOf(null)).toBeNull();
			expect(defaultBillRateOf({ currency: 'EUR', defaultBillRateValue: null })).toBeNull();
			expect(defaultBillRateOf({ currency: 'EUR', defaultBillRateValue: 0 })).toBeNull();
		});

		it('answers the default with its own currency', () => {
			expect(
				defaultBillRateOf({
					currency: 'USD',
					defaultBillRateValue: 80,
					defaultBillRateCurrency: 'EUR' as never
				})
			).toEqual({ value: 80, currency: 'EUR' });
		});

		it("states a default without a currency in the organization's, and reads a numeric column read as text", () => {
			expect(
				defaultBillRateOf({
					currency: 'USD',
					defaultBillRateValue: '80.00' as never,
					defaultBillRateCurrency: null
				})
			).toEqual({ value: 80, currency: 'USD' });
		});
	});

	describe('pricesAtDefault', () => {
		it('prices a member without a rate at the default, never one with a rate, and nobody without a default', () => {
			expect(pricesAtDefault({ billRateValue: 0 }, EIGHTY_EUR)).toBe(true);
			expect(pricesAtDefault({ billRateValue: 60 }, EIGHTY_EUR)).toBe(false);
			expect(pricesAtDefault({ billRateValue: 0 }, null)).toBe(false);
		});
	});

	describe('billRateOf', () => {
		it('keeps the rate of a member who has one, in its currency', () => {
			expect(billRateOf({ billRateValue: 60, billRateCurrency: 'USD' as never }, 'KWD', EIGHTY_EUR)).toEqual({
				rate: 60,
				currency: 'USD'
			});
		});

		it('prices a member without a rate at the default, in the default currency', () => {
			expect(billRateOf({ billRateValue: 0, billRateCurrency: 'USD' as never }, 'KWD', EIGHTY_EUR)).toEqual({
				rate: 80,
				currency: 'EUR'
			});
		});

		it('answers exactly what was stored when the organization sets no default', () => {
			expect(billRateOf({ billRateValue: null, billRateCurrency: null }, 'KWD', null)).toEqual({
				rate: null,
				currency: 'KWD'
			});
			expect(billRateOf({ billRateValue: 0, billRateCurrency: 'USD' as never }, null, null)).toEqual({
				rate: 0,
				currency: 'USD'
			});
		});
	});

	describe('budgetNeedsDefaultRate', () => {
		const withRate = { employee: { billRateValue: 60 } };
		const withoutRate = { employee: { billRateValue: 0 } };

		it('needs it for a cost budget that holds time of a member without a rate', () => {
			expect(budgetNeedsDefaultRate([{ budgetType: 'cost', timeLogs: [withRate, withoutRate] }], 'hours')).toBe(
				true
			);
		});

		it('does not need it when every member has a rate, or for an hour budget', () => {
			expect(budgetNeedsDefaultRate([{ budgetType: 'cost', timeLogs: [withRate] }], 'hours')).toBe(false);
			expect(budgetNeedsDefaultRate([{ budgetType: 'hours', timeLogs: [withoutRate] }], 'hours')).toBe(false);
			expect(budgetNeedsDefaultRate([{ budgetType: 'cost' }], 'hours')).toBe(false);
		});
	});
});
