import * as moment from 'moment';
import { IExpense } from '@gauzy/contracts';
import {
	categoryMonthBars,
	categoryReadRange,
	comparableExpenses,
	monthShareOf,
	vendorPaymentBars,
	vendorReadRange
} from './expense-view-charts';

function expense(id: string, valueDate: string, amount: number, currency = 'USD'): IExpense {
	return { id, valueDate: new Date(`${valueDate}T12:00:00`), amount, currency } as IExpense;
}

describe('expense view charts', () => {
	const current = expense('current', '2026-03-10', 100);

	describe('comparableExpenses', () => {
		it('keeps the expense currency only and counts the expense itself once, as the page read it', () => {
			const listed = [
				expense('current', '2026-03-10', 40), // the list's older copy, before an edit
				expense('a', '2026-03-02', 50),
				expense('b', '2026-03-03', 70, 'EUR')
			];

			expect(comparableExpenses(listed, current).map((item) => [item.id, item.amount])).toEqual([
				['a', 50],
				['current', 100]
			]);
		});
	});

	describe('categoryMonthBars', () => {
		it('sums each of the six months up to the expense month, which is the highlighted last bar', () => {
			const bars = categoryMonthBars(
				[expense('a', '2026-03-02', 50.1), expense('b', '2026-01-20', 30.2), expense('c', '2025-09-01', 999)],
				current
			);

			expect(bars.map((bar) => bar.label)).toEqual(['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar']);
			expect(bars.map((bar) => bar.value)).toEqual([0, 0, 0, 30.2, 0, 150.1]);
			expect(bars.map((bar) => bar.highlight)).toEqual([false, false, false, false, false, true]);
			expect(bars[5].title).toBe('March 2026');
		});

		it('covers the span the range filter picks, still ending with the expense month', () => {
			const bars = categoryMonthBars([expense('a', '2026-01-20', 30), expense('b', '2025-12-05', 999)], current, 'en', 3);

			expect(bars.map((bar) => bar.label)).toEqual(['Jan', 'Feb', 'Mar']);
			expect(bars.map((bar) => bar.value)).toEqual([30, 0, 100]);
		});

		it('draws nothing for an expense without a date', () => {
			expect(categoryMonthBars([], { ...current, valueDate: null })).toEqual([]);
		});
	});

	describe('vendorPaymentBars', () => {
		const payments = Array.from({ length: 15 }, (_, day) =>
			expense(`p${day + 1}`, `2026-02-${String(day + 1).padStart(2, '0')}`, day + 1)
		);

		it('lists the latest payments in date order, the expense among them', () => {
			const bars = vendorPaymentBars(payments, current, 'en', 12);

			expect(bars).toHaveLength(12);
			expect(bars[11]).toEqual(expect.objectContaining({ value: 100, highlight: true, label: '10 Mar' }));
			expect(bars.filter((bar) => bar.highlight)).toHaveLength(1);
		});

		it('for an older expense, shows the payments leading up to it', () => {
			const old = expense('old', '2026-01-05', 7);
			const bars = vendorPaymentBars(payments, old, 'en', 4);

			expect(bars.map((bar) => bar.value)).toEqual([7, 1, 2, 3]);
			expect(bars[0].highlight).toBe(true);
		});
	});

	describe('read ranges', () => {
		const utc = (value: string) => moment(value).utc().format('YYYY-MM-DD HH:mm:ss');

		it('reads the category over the longest span, through the end of the expense month', () => {
			expect(categoryReadRange(current)).toEqual({
				startDate: utc('2025-04-01T00:00:00'),
				endDate: utc('2026-03-31T23:59:59')
			});
		});

		it('reads the vendor payments up to the expense', () => {
			expect(vendorReadRange(current)).toEqual({ startDate: '1970-01-01 00:00:00', endDate: utc('2026-03-10T12:00:00') });
		});

		it('reads nothing for an expense without a date', () => {
			expect(categoryReadRange({ ...current, valueDate: null })).toBeNull();
			expect(vendorReadRange({ ...current, valueDate: null })).toBeNull();
		});
	});

	describe('monthShareOf', () => {
		it('gives the expense share of its month in its category', () => {
			const share = monthShareOf([expense('a', '2026-03-02', 300), expense('b', '2026-02-27', 500)], current);

			expect(share).toEqual({ amount: 100, rest: 300, total: 400, percent: 25 });
		});

		it('is the whole month when nothing else was spent', () => {
			expect(monthShareOf([], current)?.percent).toBe(100);
		});

		it('keeps the digits amounts are stored with, whatever the currency: three for the dinar', () => {
			const kwd = expense('kwd', '2026-03-10', 1.234, 'KWD');

			expect(monthShareOf([expense('a', '2026-03-02', 2.001, 'KWD')], kwd)).toEqual(
				expect.objectContaining({ amount: 1.234, rest: 2.001, total: 3.235 })
			);
		});

		it('keeps fractions of a yen, so the segments make up the total and the share', () => {
			const yen = expense('yen', '2026-03-10', 0.49, 'JPY');

			const share = monthShareOf([expense('a', '2026-03-02', 0.49, 'JPY')], yen);

			expect(share).toEqual({ amount: 0.49, rest: 0.49, total: 0.98, percent: 50 });
			expect(share.amount + share.rest).toBeCloseTo(share.total, 6);
		});

		it('is none for an expense without an amount', () => {
			expect(monthShareOf([], { ...current, amount: 0 })).toBeNull();
		});
	});
});
