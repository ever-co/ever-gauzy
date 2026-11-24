import * as moment from 'moment';
import { IEquipmentSharing, RequestApprovalStatusTypesEnum } from '@gauzy/contracts';
import { IExpenseChartBar, IExpenseMonthShare } from '../../expenses/expense-view/expense-view-charts';

/** The months the equipment charts span by default, and the spans their range filter offers. */
export const EQUIPMENT_CHART_MONTHS = 12;
export const EQUIPMENT_CHART_MONTH_OPTIONS = [6, 12, 24];

/** The sharing dates the charts read: a subset of the sharing, so a test can build one by hand. */
export type IEquipmentChartSharing = Pick<
	IEquipmentSharing,
	'status' | 'shareRequestDay' | 'shareStartDay' | 'shareEndDay' | 'createdAt'
>;

/** A run of booked days, both ends included, as day numbers (see {@link dayNumber}). */
export type IDayRange = [start: number, end: number];

const DAY_MS = 86_400_000;

/**
 * A calendar day as a whole number — days since 1 January 1970 — read in the viewer's time zone, as the dates are
 * shown. Ranges of days are then plain integer ranges: no date object per day, no string key per day.
 */
export function dayNumber(date: Date | string | moment.Moment): number {
	const day = moment(date);
	return Math.round(Date.UTC(day.year(), day.month(), day.date()) / DAY_MS);
}

/**
 * The days the equipment is booked — covered by an approved sharing, start and end days included — between `from`
 * and `to`, as runs of days in order. Overlapping or touching sharings make one run, so a day two sharings share
 * counts once.
 */
export function bookedRanges(sharings: IEquipmentChartSharing[], from: number, to: number): IDayRange[] {
	const ranges: IDayRange[] = [];
	for (const sharing of sharings ?? []) {
		if (sharing?.status !== RequestApprovalStatusTypesEnum.APPROVED || !sharing.shareStartDay) {
			continue;
		}
		// A sharing without an end day is booked for its start day only.
		const start = Math.max(dayNumber(sharing.shareStartDay), from);
		const end = Math.min(dayNumber(sharing.shareEndDay ?? sharing.shareStartDay), to);
		if (start <= end) {
			ranges.push([start, end]);
		}
	}
	ranges.sort((a, b) => a[0] - b[0]);
	const merged: IDayRange[] = [];
	for (const range of ranges) {
		const last = merged[merged.length - 1];
		if (last && range[0] <= last[1] + 1) {
			last[1] = Math.max(last[1], range[1]);
		} else {
			merged.push([range[0], range[1]]);
		}
	}
	return merged;
}

/** How many of the days from `from` to `to` (both included) the runs cover. */
export function daysCovered(ranges: IDayRange[], from: number, to: number): number {
	let days = 0;
	for (const [start, end] of ranges) {
		if (start > to) {
			break; // the runs are in order: none after this one reaches the span
		}
		const overlap = Math.min(end, to) - Math.max(start, from) + 1;
		if (overlap > 0) {
			days += overlap;
		}
	}
	return days;
}

/** The months the charts draw, oldest first, ending with `today`'s month. */
function chartMonths(months: number, today: moment.Moment, locale: string): moment.Moment[] {
	const end = today.clone().startOf('month');
	return Array.from({ length: months }, (_, index) =>
		end.clone().subtract(months - 1 - index, 'months').locale(locale)
	);
}

function barOf(month: moment.Moment, value: number, today: moment.Moment): IExpenseChartBar {
	return {
		label: month.format('MMM'),
		title: month.format('MMMM YYYY'),
		value,
		highlight: month.isSame(today, 'month')
	};
}

/** The days booked in each of the last `months` months, the current month highlighted. */
export function bookedDayBars(
	sharings: IEquipmentChartSharing[],
	months = EQUIPMENT_CHART_MONTHS,
	locale = 'en',
	today: moment.Moment = moment()
): IExpenseChartBar[] {
	const range = chartMonths(months, today, locale);
	const ranges = bookedRanges(sharings, dayNumber(range[0]), dayNumber(today.clone().endOf('month')));
	return range.map((month) =>
		barOf(month, daysCovered(ranges, dayNumber(month), dayNumber(month.clone().endOf('month'))), today)
	);
}

/** The sharing requests made in each of the last `months` months, whatever became of them. */
export function requestBars(
	sharings: IEquipmentChartSharing[],
	months = EQUIPMENT_CHART_MONTHS,
	locale = 'en',
	today: moment.Moment = moment()
): IExpenseChartBar[] {
	// Months as whole numbers (year × 12 + month), read with the Date's own getters: no formatting per request.
	const perMonth = new Map<number, number>();
	for (const sharing of sharings ?? []) {
		const asked = sharing?.shareRequestDay ?? sharing?.createdAt;
		if (!asked) {
			continue;
		}
		const date = new Date(asked);
		const key = date.getFullYear() * 12 + date.getMonth();
		perMonth.set(key, (perMonth.get(key) ?? 0) + 1);
	}
	return chartMonths(months, today, locale).map((month) =>
		barOf(month, perMonth.get(month.year() * 12 + month.month()) ?? 0, today)
	);
}

/**
 * The days booked this year up to `today`, against the days the year has had so far (today included): what the
 * ring in the side column draws.
 */
export function yearUse(sharings: IEquipmentChartSharing[], today: moment.Moment = moment()): IExpenseMonthShare {
	const start = dayNumber(today.clone().startOf('year'));
	const end = dayNumber(today);
	const total = end - start + 1;
	const amount = daysCovered(bookedRanges(sharings, start, end), start, end);
	return {
		amount,
		rest: Math.max(total - amount, 0),
		total,
		percent: total ? Math.round((amount / total) * 1000) / 10 : 0
	};
}
