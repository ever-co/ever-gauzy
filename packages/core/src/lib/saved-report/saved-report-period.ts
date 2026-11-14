import type { Moment } from 'moment';
import { moment } from '../core/moment-extend';
import { ISavedReport, SavedReportPeriodRuleEnum, WeekDaysEnum } from '@gauzy/contracts';

/** The zone a report without a known zone counts its days in. */
export const SAVED_REPORT_DEFAULT_TIME_ZONE = 'UTC';

/** A day as stored and answered: `YYYY-MM-DD`. */
export const SAVED_REPORT_DAY_FORMAT = 'YYYY-MM-DD';

/** The longest span fixed dates may cover, in days: a public link should not read years of time at every opening. */
export const SAVED_REPORT_MAX_FIXED_DAYS = 366;

/** The days a saved report covers when it is read, and the instants that bound them in its zone. */
export interface ISavedReportPeriod {
	/** The first day, `YYYY-MM-DD`, in `timeZone`. */
	startDate: string;
	/** The last day, `YYYY-MM-DD`, in `timeZone`, included. */
	endDate: string;
	/** The first instant of the first day in `timeZone`: what the report page sends as `startDate`. */
	start: Date;
	/** The last millisecond of the last day in `timeZone`: what the report page sends as `endDate`. */
	end: Date;
	timeZone: string;
}

/** Day numbers as moment counts them (Sunday 0), for the organization's first day of the week. */
const WEEK_DAY_NUMBERS: Readonly<Record<WeekDaysEnum, number>> = {
	[WeekDaysEnum.SUNDAY]: 0,
	[WeekDaysEnum.MONDAY]: 1,
	[WeekDaysEnum.TUESDAY]: 2,
	[WeekDaysEnum.WEDNESDAY]: 3,
	[WeekDaysEnum.THURSDAY]: 4,
	[WeekDaysEnum.FRIDAY]: 5,
	[WeekDaysEnum.SATURDAY]: 6
};

/**
 * The zone a report counts its days in: its own when moment knows it, UTC otherwise.
 *
 * @param timeZone The stored IANA zone.
 */
export function savedReportTimeZoneOf(timeZone: string | null | undefined): string {
	const isKnown = !!timeZone && moment.tz.zone(timeZone) !== null;
	if (isKnown) {
		return timeZone;
	}
	return SAVED_REPORT_DEFAULT_TIME_ZONE;
}

/**
 * The day number (Sunday 0) a week starts on: the organization's setting, Monday when it has none, as the report pages
 * count weeks.
 *
 * @param startWeekOn The organization's first day of the week.
 */
export function weekStartDayOf(startWeekOn: WeekDaysEnum | string | null | undefined): number {
	const day = WEEK_DAY_NUMBERS[startWeekOn as WeekDaysEnum];
	if (day === undefined) {
		return WEEK_DAY_NUMBERS[WeekDaysEnum.MONDAY];
	}
	return day;
}

/** The first day of the week `day` falls in. */
function weekStartOf(day: Moment, weekStartsOn: number): Moment {
	const daysSinceStart = (day.day() - weekStartsOn + 7) % 7;
	return day.clone().subtract(daysSinceStart, 'days');
}

/** The first and last days a rule covers on `today` (the start of the reading day, in the report's zone). */
function daysOfRule(rule: SavedReportPeriodRuleEnum, today: Moment, weekStartsOn: number): [Moment, Moment] {
	switch (rule) {
		case SavedReportPeriodRuleEnum.TODAY:
			return [today.clone(), today.clone()];
		case SavedReportPeriodRuleEnum.YESTERDAY: {
			const yesterday = today.clone().subtract(1, 'day');
			return [yesterday, yesterday.clone()];
		}
		case SavedReportPeriodRuleEnum.THIS_WEEK: {
			const first = weekStartOf(today, weekStartsOn);
			return [first, first.clone().add(6, 'days')];
		}
		case SavedReportPeriodRuleEnum.LAST_WEEK: {
			const first = weekStartOf(today.clone().subtract(7, 'days'), weekStartsOn);
			return [first, first.clone().add(6, 'days')];
		}
		case SavedReportPeriodRuleEnum.LAST_7_DAYS:
			return [today.clone().subtract(6, 'days'), today.clone()];
		case SavedReportPeriodRuleEnum.LAST_14_DAYS:
			return [today.clone().subtract(13, 'days'), today.clone()];
		case SavedReportPeriodRuleEnum.THIS_MONTH:
			return [today.clone().startOf('month'), today.clone().endOf('month').startOf('day')];
		case SavedReportPeriodRuleEnum.LAST_MONTH: {
			const month = today.clone().subtract(1, 'month');
			return [month.clone().startOf('month'), month.clone().endOf('month').startOf('day')];
		}
		default:
			throw new Error(`Unknown period rule: ${rule}`);
	}
}

/** A stored day read in `timeZone`; null when it is not a real `YYYY-MM-DD` day. */
export function dayIn(value: string | null | undefined, timeZone: string): Moment | null {
	if (!value) {
		return null;
	}
	const day = moment.tz(value, SAVED_REPORT_DAY_FORMAT, true, timeZone);
	if (!day.isValid()) {
		return null;
	}
	return day.startOf('day');
}

/** The period of two days, with the instants that bound them in `timeZone`. */
function periodOfDays(first: Moment, last: Moment, timeZone: string): ISavedReportPeriod {
	return {
		startDate: first.format(SAVED_REPORT_DAY_FORMAT),
		endDate: last.format(SAVED_REPORT_DAY_FORMAT),
		start: first.clone().startOf('day').toDate(),
		end: last.clone().endOf('day').toDate(),
		timeZone
	};
}

/**
 * The period a saved report covers when it is read: its rule evaluated on `now` in its zone (so "last month" moves with
 * the calendar), or its fixed days.
 *
 * @param report The stored rule or days, and the zone.
 * @param weekStartsOn The day number (Sunday 0) the organization's weeks start on.
 * @param now When the report is read.
 * @returns The days and their bounds; null when the report states neither a known rule nor two real days in order.
 */
export function resolveSavedReportPeriod(
	report: Pick<ISavedReport, 'periodRule' | 'startDate' | 'endDate' | 'timeZone'>,
	weekStartsOn: number,
	now: Date
): ISavedReportPeriod | null {
	const timeZone = savedReportTimeZoneOf(report.timeZone);
	const rule = report.periodRule;
	const isKnownRule = !!rule && Object.values(SavedReportPeriodRuleEnum).includes(rule);
	if (isKnownRule) {
		const today = moment.tz(now, timeZone).startOf('day');
		const [first, last] = daysOfRule(rule, today, weekStartsOn);
		return periodOfDays(first, last, timeZone);
	}
	const first = dayIn(report.startDate, timeZone);
	const last = dayIn(report.endDate, timeZone);
	const hasBothDays = first !== null && last !== null;
	if (!hasBothDays) {
		return null;
	}
	if (last.isBefore(first)) {
		return null;
	}
	return periodOfDays(first, last, timeZone);
}

/**
 * How many days fixed dates cover, both included; null when they are not two real days in order.
 *
 * @param startDate The first day, `YYYY-MM-DD`.
 * @param endDate The last day, `YYYY-MM-DD`.
 */
export function fixedDaysCount(startDate: string, endDate: string): number | null {
	const first = dayIn(startDate, SAVED_REPORT_DEFAULT_TIME_ZONE);
	const last = dayIn(endDate, SAVED_REPORT_DEFAULT_TIME_ZONE);
	const hasBothDays = first !== null && last !== null;
	if (!hasBothDays) {
		return null;
	}
	if (last.isBefore(first)) {
		return null;
	}
	return last.diff(first, 'days') + 1;
}
