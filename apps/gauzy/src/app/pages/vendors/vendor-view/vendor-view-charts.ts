import * as moment from 'moment';
import { IExpense } from '@gauzy/contracts';
import { IExpenseChartBar } from '../../expenses/expense-view/expense-view-charts';

export const VENDOR_CHART_MONTHS = 12;
export const VENDOR_CHART_MONTH_OPTIONS = [6, 12, 24];

export type IVendorChartExpense = Pick<IExpense, 'amount' | 'currency' | 'valueDate'>;

function amountOf(expense: IVendorChartExpense): number {
	const amount = Number(expense?.amount);
	return Number.isFinite(amount) ? amount : 0;
}

function round(value: number): number {
	return Math.round(value * 1e6) / 1e6;
}

export function currenciesOf(expenses: IVendorChartExpense[]): string[] {
	return [...new Set((expenses ?? []).filter((e) => e?.valueDate && e.currency).map((e) => e.currency))];
}

export function chartCurrencyOf(expenses: IVendorChartExpense[]): string | null {
	const counts = new Map<string, number>();
	for (const expense of expenses ?? []) {
		if (expense?.valueDate && expense.currency) {
			counts.set(expense.currency, (counts.get(expense.currency) ?? 0) + 1);
		}
	}
	let best: string | null = null;
	let bestCount = 0;
	for (const [currency, count] of counts) {
		if (count > bestCount) {
			best = currency;
			bestCount = count;
		}
	}
	return best;
}

export function spendBars(
	expenses: IVendorChartExpense[],
	currency: string | null,
	months = VENDOR_CHART_MONTHS,
	locale = 'en',
	today: moment.Moment = moment()
): IExpenseChartBar[] {
	const perMonth = new Map<number, number>();
	for (const expense of expenses ?? []) {
		if (!expense?.valueDate || (expense.currency ?? null) !== currency) {
			continue;
		}
		const date = new Date(expense.valueDate);
		const key = date.getFullYear() * 12 + date.getMonth();
		perMonth.set(key, (perMonth.get(key) ?? 0) + amountOf(expense));
	}
	const end = today.clone().startOf('month');
	return Array.from({ length: months }, (_, index) => {
		const month = end
			.clone()
			.subtract(months - 1 - index, 'months')
			.locale(locale);
		return {
			label: month.format('MMM'),
			title: month.format('MMMM YYYY'),
			value: round(perMonth.get(month.year() * 12 + month.month()) ?? 0),
			highlight: month.isSame(today, 'month')
		};
	});
}
