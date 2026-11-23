import * as moment from 'moment';
import { chartCurrencyOf, currenciesOf, spendBars } from './vendor-view-charts';

describe('vendor view charts', () => {
	const today = moment('2026-11-15T12:00:00');

	describe('chartCurrencyOf', () => {
		it('picks the currency most expenses are in', () => {
			expect(
				chartCurrencyOf([
					{ amount: 1, currency: 'EUR', valueDate: new Date('2026-01-01') },
					{ amount: 1, currency: 'USD', valueDate: new Date('2026-02-01') },
					{ amount: 1, currency: 'USD', valueDate: new Date('2026-03-01') }
				])
			).toBe('USD');
		});

		it('ignores undated expenses and is null when there are none', () => {
			expect(chartCurrencyOf([{ amount: 5, currency: 'USD', valueDate: undefined }])).toBeNull();
			expect(chartCurrencyOf([])).toBeNull();
		});
	});

	it('lists each currency once', () => {
		expect(
			currenciesOf([
				{ amount: 1, currency: 'USD', valueDate: new Date('2026-01-01') },
				{ amount: 1, currency: 'USD', valueDate: new Date('2026-02-01') },
				{ amount: 1, currency: 'EUR', valueDate: new Date('2026-03-01') }
			])
		).toEqual(['USD', 'EUR']);
	});

	describe('spendBars', () => {
		it('draws one bar per month, oldest first, ending with the current month highlighted', () => {
			const bars = spendBars([], 'USD', 6, 'en', today);
			expect(bars.map((bar) => bar.label)).toEqual(['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov']);
			expect(bars.map((bar) => bar.highlight)).toEqual([false, false, false, false, false, true]);
			expect(bars.every((bar) => bar.value === 0)).toBe(true);
		});

		it('adds up the month’s expenses in the chart currency only', () => {
			const bars = spendBars(
				[
					{ amount: 100.1, currency: 'USD', valueDate: new Date('2026-10-03T10:00:00') },
					{ amount: '0.2' as unknown as number, currency: 'USD', valueDate: new Date('2026-10-20T10:00:00') },
					{ amount: 999, currency: 'EUR', valueDate: new Date('2026-10-05T10:00:00') },
					{ amount: 50, currency: 'USD', valueDate: new Date('2026-11-01T10:00:00') }
				],
				'USD',
				3,
				'en',
				today
			);
			expect(bars.map((bar) => bar.value)).toEqual([0, 100.3, 50]);
		});

		it('keeps negative amounts, so a month matches the summary total', () => {
			const bars = spendBars(
				[
					{ amount: 100, currency: 'USD', valueDate: new Date('2026-11-02T10:00:00') },
					{ amount: -20, currency: 'USD', valueDate: new Date('2026-11-05T10:00:00') }
				],
				'USD',
				1,
				'en',
				today
			);
			expect(bars.map((bar) => bar.value)).toEqual([80]);
		});

		it('counts an amount that is not a number as zero', () => {
			const bars = spendBars(
				[
					{ amount: 'abc' as unknown as number, currency: 'USD', valueDate: new Date('2026-11-02T10:00:00') },
					{ amount: 30, currency: 'USD', valueDate: new Date('2026-11-05T10:00:00') }
				],
				'USD',
				1,
				'en',
				today
			);
			expect(bars.map((bar) => bar.value)).toEqual([30]);
		});

		it('leaves out expenses older than the span', () => {
			const bars = spendBars(
				[{ amount: 10, currency: 'USD', valueDate: new Date('2025-01-10T10:00:00') }],
				'USD',
				12,
				'en',
				today
			);
			expect(bars.reduce((sum, bar) => sum + bar.value, 0)).toBe(0);
		});
	});
});
