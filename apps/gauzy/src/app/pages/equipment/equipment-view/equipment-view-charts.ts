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

const DAY_KEY = 'YYYY-MM-DD';
const MONTH_KEY = 'YYYY-MM';

/**
 * The days the equipment is booked — covered by an approved sharing, start and end days included — between `from`
 * and `to`. A day two sharings overlap on counts once.
 */
export function bookedDays(sharings: IEquipmentChartSharing[], from: moment.Moment, to: moment.Moment): Set<string> {
	const days = new Set<string>();
	for (const sharing of sharings ?? []) {
		if (sharing?.status !== RequestApprovalStatusTypesEnum.APPROVED || !sharing.shareStartDay) {
			continue;
		}
		const start = moment.max(moment(sharing.shareStartDay).startOf('day'), from.clone().startOf('day'));
		// A sharing without an end day is booked for its start day only.
		const end = moment.min(moment(sharing.shareEndDay ?? sharing.shareStartDay).startOf('day'), to.clone().startOf('day'));
		for (const day = start.clone(); !day.isAfter(end); day.add(1, 'day')) {
			days.add(day.format(DAY_KEY));
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
	const days = bookedDays(sharings, range[0].clone().startOf('month'), today.clone().endOf('month'));
	const perMonth = new Map<string, number>();
	days.forEach((day) => {
		const key = day.slice(0, 7);
		perMonth.set(key, (perMonth.get(key) ?? 0) + 1);
	});
	return range.map((month) => barOf(month, perMonth.get(month.format(MONTH_KEY)) ?? 0, today));
}

/** The sharing requests made in each of the last `months` months, whatever became of them. */
export function requestBars(
	sharings: IEquipmentChartSharing[],
	months = EQUIPMENT_CHART_MONTHS,
	locale = 'en',
	today: moment.Moment = moment()
): IExpenseChartBar[] {
	const perMonth = new Map<string, number>();
	for (const sharing of sharings ?? []) {
		const asked = sharing?.shareRequestDay ?? sharing?.createdAt;
		if (!asked) {
			continue;
		}
		const key = moment(asked).format(MONTH_KEY);
		perMonth.set(key, (perMonth.get(key) ?? 0) + 1);
	}
	return chartMonths(months, today, locale).map((month) =>
		barOf(month, perMonth.get(month.format(MONTH_KEY)) ?? 0, today)
	);
}

/**
 * The days booked this year up to `today`, against the days the year has had so far (today included): what the
 * ring in the side column draws.
 */
export function yearUse(sharings: IEquipmentChartSharing[], today: moment.Moment = moment()): IExpenseMonthShare {
	const start = today.clone().startOf('year');
	const total = today.clone().startOf('day').diff(start, 'days') + 1;
	const amount = bookedDays(sharings, start, today).size;
	return {
		amount,
		rest: Math.max(total - amount, 0),
		total,
		percent: total ? Math.round((amount / total) * 1000) / 10 : 0
	};
}
