import { moment } from '../core/moment-extend';
import { resolveTimeZone } from '../core/utils';

/**
 * Working days of a time-off request, per calendar year (issue #10183).
 *
 * Pure: no database, no request context. The caller reads the organization's time zone and official holidays and
 * hands them in, so the same counting serves the approval flow today and an accrual job or a report later.
 */

/** A calendar day, `YYYY-MM-DD`. */
export type CalendarDay = string;

/** The days of the week (`0` = Sunday … `6` = Saturday) that are not working days unless an organization says otherwise. */
export const DEFAULT_WEEKEND_DAYS: ReadonlyArray<number> = Object.freeze([0, 6]);

/** An official holiday, as the `official_holiday` table stores it. */
export interface ITimeOffHolidayDates {
	/** The holiday, or the first day of a multi-day holiday. */
	date: Date | string;
	/** The last day of a multi-day holiday. */
	endDate?: Date | string | null;
	/** Whether it falls on the same month and day every year. */
	isRecurring?: boolean | null;
}

export interface IWorkingDaysOptions {
	/**
	 * The zone the request's days were picked in. The forms save a picked day as the browser's local midnight, so a
	 * day picked in UTC+2 is stored as 22:00 UTC the day before; the organization's zone is the closest the server
	 * knows to the picker's. Unset falls back to the server's zone, as the reports do.
	 */
	timeZone?: string | null;
	/** Official holidays of the organization: a working day on one of them is not counted. */
	holidays?: ReadonlyArray<ITimeOffHolidayDates>;
	/** The days of the week that are not working days. Defaults to {@link DEFAULT_WEEKEND_DAYS}. */
	weekendDays?: ReadonlyArray<number>;
}

/** The working days a request takes in one calendar year. */
export interface IWorkingDaysOfYear {
	year: number;
	days: number;
}

const DAY_FORMAT = 'YYYY-MM-DD';
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** The longest holiday span expanded, in days: a guard against a mistyped `endDate`, not a calendar rule. */
const MAX_HOLIDAY_SPAN_DAYS = 366;

/**
 * The calendar day a stored request bound falls on, in `timeZone`.
 *
 * A date-only string (`2026-11-02`) already is that day. A timestamp is read as UTC and moved into the zone.
 *
 * @returns the day, or `null` when the value is not a date.
 */
export function calendarDayOf(value: Date | string | null | undefined, timeZone?: string | null): CalendarDay | null {
	if (value === null || value === undefined || value === '') {
		return null;
	}
	if (typeof value === 'string' && DATE_ONLY.test(value)) {
		return moment.utc(value, DAY_FORMAT, true).isValid() ? value : null;
	}
	// A string is read as ISO 8601 (a SQL `YYYY-MM-DD HH:mm:ss` included), never through `Date`'s own guessing.
	const instant = typeof value === 'string' ? moment.utc(value, moment.ISO_8601) : moment.utc(value);
	return instant.isValid() ? instant.tz(resolveTimeZone(timeZone ?? undefined)).format(DAY_FORMAT) : null;
}

/**
 * Every calendar day from `start` to `end`, both included, in `timeZone`.
 *
 * @returns the days in order; none when either bound is not a date or the request ends before it starts.
 */
export function calendarDaysBetween(
	start: Date | string | null | undefined,
	end: Date | string | null | undefined,
	timeZone?: string | null
): CalendarDay[] {
	const first = calendarDayOf(start, timeZone);
	const last = calendarDayOf(end, timeZone);
	if (!first || !last || last < first) {
		return [];
	}
	return expandDays(first, last, Number.POSITIVE_INFINITY);
}

/**
 * The working days from `start` to `end`, both included, split per calendar year: weekends and the organization's
 * official holidays are not counted. A request crossing 31 December takes its days from each year's balance.
 *
 * @returns one entry per year with at least one working day, earliest first.
 */
export function workingDaysByYear(
	start: Date | string | null | undefined,
	end: Date | string | null | undefined,
	options: IWorkingDaysOptions = {}
): IWorkingDaysOfYear[] {
	const weekendDays = new Set(options.weekendDays ?? DEFAULT_WEEKEND_DAYS);
	const isHoliday = holidayMatcher(options.holidays ?? []);
	const perYear = new Map<number, number>();

	for (const day of calendarDaysBetween(start, end, options.timeZone)) {
		if (weekendDays.has(moment.utc(day, DAY_FORMAT).day()) || isHoliday(day)) {
			continue;
		}
		const year = Number(day.slice(0, 4));
		perYear.set(year, (perYear.get(year) ?? 0) + 1);
	}

	return [...perYear.entries()].sort(([a], [b]) => a - b).map(([year, days]) => ({ year, days }));
}

/**
 * Whether a calendar day is one of the holidays.
 *
 * A one-off holiday covers its own days. A recurring one covers the same month and day every year, the year it was
 * entered for included — the holiday listing's "falls in this year or recurs" — so a span across New Year
 * (31 December to 1 January) recurs as such, and 29 February recurs in leap years only.
 */
export function holidayMatcher(holidays: ReadonlyArray<ITimeOffHolidayDates>): (day: CalendarDay) => boolean {
	const oneOff = new Set<CalendarDay>();
	const recurring = new Set<string>();

	for (const holiday of holidays) {
		const first = storedDayOf(holiday.date);
		if (!first) {
			continue;
		}
		const last = storedDayOf(holiday.endDate) ?? first;
		for (const day of expandDays(first, last < first ? first : last, MAX_HOLIDAY_SPAN_DAYS)) {
			if (holiday.isRecurring) {
				recurring.add(day.slice(5));
			} else {
				oneOff.add(day);
			}
		}
	}

	return (day: CalendarDay) => oneOff.has(day) || recurring.has(day.slice(5));
}

/**
 * The day a `date` column holds. TypeORM hands a `date` column back as `YYYY-MM-DD`; a driver that builds a `Date`
 * builds it at the server's local midnight, which is why that one is read in the local zone.
 */
function storedDayOf(value: Date | string | null | undefined): CalendarDay | null {
	if (value === null || value === undefined || value === '') {
		return null;
	}
	const day = typeof value === 'string' ? moment.utc(value.slice(0, 10), DAY_FORMAT, true) : moment(value);
	return day.isValid() ? day.format(DAY_FORMAT) : null;
}

/** The days from `first` to `last`, both included, at most `limit` of them. */
function expandDays(first: CalendarDay, last: CalendarDay, limit: number): CalendarDay[] {
	const days: CalendarDay[] = [];
	const cursor = moment.utc(first, DAY_FORMAT);
	for (let day = first; day <= last && days.length < limit; day = cursor.add(1, 'day').format(DAY_FORMAT)) {
		days.push(day);
	}
	return days;
}
