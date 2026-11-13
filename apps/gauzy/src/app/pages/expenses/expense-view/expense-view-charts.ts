import * as moment from 'moment';

/**
 * What the charts read of a record: an amount on a date, in a currency. An expense is one, and so is an income —
 * the income page draws its client's months and payments with these same helpers.
 */
export interface IChartAmountRecord {
	id?: string;
	amount?: number | string;
	currency?: string;
	valueDate?: Date | string;
}

/** How many months the category chart covers, ending with the expense's own month. */
export const CATEGORY_CHART_MONTHS = 6;
/** The spans the category chart's range filter offers, in months. */
export const CATEGORY_CHART_MONTH_OPTIONS = [3, 6, 12];
/** How many payments to the vendor the history chart shows at most. */
export const VENDOR_CHART_PAYMENTS = 12;
/** The counts the vendor chart's range filter offers, in payments. */
export const VENDOR_CHART_PAYMENT_OPTIONS = [6, 12, 24];

/** The longest span and the most payments the filters offer: the charts read that much once, and a filter only redraws. */
export const CATEGORY_CHART_READ_MONTHS = Math.max(...CATEGORY_CHART_MONTH_OPTIONS);
export const VENDOR_CHART_READ_PAYMENTS = Math.max(...VENDOR_CHART_PAYMENT_OPTIONS);

/** A `valueDate` range as the expenses API takes it: UTC, to the second, both ends included. */
export interface IExpenseDateRange {
	startDate: string;
	endDate: string;
}

/** Before any expense: the open start of the vendor chart's read of the payments up to the expense. */
const EARLIEST = moment.utc('1970-01-01');

/**
 * The dates the category chart reads: from the first month of its longest span to the end of the expense's own
 * month. The months are the viewer's, as the bars group them. None for an expense without a date.
 */
export function categoryReadRange(
	expense: IChartAmountRecord,
	months = CATEGORY_CHART_READ_MONTHS
): IExpenseDateRange | null {
	if (!expense?.valueDate) {
		return null;
	}
	const start = moment(expense.valueDate)
		.startOf('month')
		.subtract(months - 1, 'months');
	return { startDate: apiDate(start), endDate: apiDate(moment(expense.valueDate).endOf('month')) };
}

/**
 * The dates of the payments up to the expense, its own day included: the vendor chart reads the latest of them,
 * newest first. None for an expense without a date.
 */
export function vendorReadRange(expense: IChartAmountRecord): IExpenseDateRange | null {
	return expense?.valueDate ? { startDate: apiDate(EARLIEST), endDate: apiDate(moment(expense.valueDate)) } : null;
}

function apiDate(date: moment.Moment): string {
	return date.clone().utc().format('YYYY-MM-DD HH:mm:ss');
}

/** One bar: its axis label, the tooltip's title, the amount, and whether it is the expense's own. */
export interface IExpenseChartBar {
	label: string;
	title: string;
	value: number;
	highlight: boolean;
}

/** The expense against the rest of its category in its month. */
export interface IExpenseMonthShare {
	amount: number;
	rest: number;
	total: number;
	/** The expense's share of the month, 0–100. */
	percent: number;
}

/**
 * The expenses a chart adds up: those in the expense's own currency — amounts in another currency cannot be
 * summed with it — and the expense itself as the page read it, whether or not the list returned it, so an edit
 * just saved shows at once.
 */
export function comparableExpenses(expenses: IChartAmountRecord[], expense: IChartAmountRecord): IChartAmountRecord[] {
	const currency = expense?.currency ?? null;
	const others = (expenses ?? []).filter(
		(item) => item?.id !== expense?.id && item?.valueDate && (item.currency ?? null) === currency
	);
	return expense?.valueDate ? [...others, expense] : others;
}

/**
 * The category's spending per month, over the months up to and including the expense's own — that month is the
 * highlighted bar.
 */
export function categoryMonthBars(
	expenses: IChartAmountRecord[],
	expense: IChartAmountRecord,
	locale = 'en',
	months = CATEGORY_CHART_MONTHS
): IExpenseChartBar[] {
	if (!expense?.valueDate) {
		return [];
	}
	const end = moment(expense.valueDate).startOf('month');
	const totals = new Map<string, number>();
	for (const item of comparableExpenses(expenses, expense)) {
		const key = moment(item.valueDate).format('YYYY-MM');
		totals.set(key, (totals.get(key) ?? 0) + amountOf(item));
	}
	const bars: IExpenseChartBar[] = [];
	for (let back = months - 1; back >= 0; back--) {
		const month = end.clone().subtract(back, 'months').locale(locale);
		bars.push({
			label: month.format('MMM'),
			title: month.format('MMMM YYYY'),
			value: round(totals.get(month.format('YYYY-MM')) ?? 0),
			highlight: back === 0
		});
	}
	return bars;
}

/**
 * The payments to the vendor in date order, at most `limit` of them: the latest ones, or — for an older expense —
 * the ones leading up to it, so the expense itself is always one of the bars.
 */
export function vendorPaymentBars(
	expenses: IChartAmountRecord[],
	expense: IChartAmountRecord,
	locale = 'en',
	limit = VENDOR_CHART_PAYMENTS
): IExpenseChartBar[] {
	const payments = comparableExpenses(expenses, expense).sort(
		(a, b) => moment(a.valueDate).valueOf() - moment(b.valueDate).valueOf()
	);
	const index = payments.findIndex((item) => item.id === expense?.id);
	const end = Math.max(Math.min(payments.length, limit), index + 1);
	return payments.slice(Math.max(0, end - limit), end).map((item) => {
		const date = moment(item.valueDate).locale(locale);
		return {
			label: date.format('D MMM'),
			title: date.format('LL'),
			value: round(amountOf(item)),
			highlight: item.id === expense?.id
		};
	});
}

/** The expense's share of its category's spending in its month. None for an expense with no amount or date. */
export function monthShareOf(expenses: IChartAmountRecord[], expense: IChartAmountRecord): IExpenseMonthShare | null {
	const amount = amountOf(expense);
	if (!expense?.valueDate || amount <= 0) {
		return null;
	}
	const month = moment(expense.valueDate);
	const total = round(
		comparableExpenses(expenses, expense)
			.filter((item) => moment(item.valueDate).isSame(month, 'month'))
			.reduce((sum, item) => sum + amountOf(item), 0)
	);
	const share = round(amount);
	// The rest is what the total leaves of the expense, so the two segments always make up the total.
	return {
		amount: share,
		rest: round(Math.max(0, total - share)),
		total,
		percent: total > 0 ? Math.round((share / total) * 1000) / 10 : 100
	};
}

function amountOf(expense: IChartAmountRecord): number {
	const amount = Number(expense?.amount);
	return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

/**
 * Clears floating-point drift from sums (0.1 + 0.2) and keeps every digit a stored amount has: amounts are stored
 * without a fixed scale, so a currency's minor unit (whole yen, cents) would cut real ones — the money formatter
 * rounds to it for display.
 */
function round(value: number): number {
	return Math.round(value * 1e6) / 1e6;
}
