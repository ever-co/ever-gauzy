import type { Moment } from 'moment';
import { moment } from '../core/moment-extend';

/**
 * Working days of a time-off request, per calendar year (issue #10183).
 *
 * Pure: no database, no request context. The caller reads the reference time zone and the official holidays and
 * hands them in, so the same counting serves the approval flow today and an accrual job or a report later.
 *
 * Nothing here walks the request day by day: weekdays are counted per year in whole weeks plus the rest, and only
 * the holidays that fall inside the request are looked at, so a mistyped span of centuries costs no more than a
 * loop over its years.
 */

/** A calendar day, `YYYY-MM-DD`. */
export type CalendarDay = string;

/** Which end of a request a stored value is: an end may be stored as the last instant of its day. */
export type CalendarBound = 'start' | 'end';

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
	 * The zone the request's days are read in (see {@link calendarDayOf}): the zone of whoever picked them, as far as
	 * the server knows it. Unset or unknown reads UTC.
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

/** The calendar days a request covers, both included. */
export interface ICalendarSpan {
	first: CalendarDay;
	last: CalendarDay;
	/** How many calendar days, both ends included. */
	days: number;
}

const DAY_FORMAT = 'YYYY-MM-DD';
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** The longest holiday span expanded, in days: a guard against a mistyped `endDate`, not a calendar rule. */
const MAX_HOLIDAY_SPAN_DAYS = 366;

/** `timeZone` when it is a zone moment knows, else UTC. */
export function knownTimeZone(timeZone?: string | null): string {
	return typeof timeZone === 'string' && timeZone.trim() !== '' && moment.tz.zone(timeZone.trim())
		? timeZone.trim()
		: 'UTC';
}

/**
 * The calendar day a stored request bound stands for, read in `timeZone`.
 *
 * - A date-only string (`2026-11-02`) already is that day.
 * - A timestamp is the midnight a date picker produced in its browser's zone: it is read as the NEAREST midnight in
 *   `timeZone`. A picker midnight from any zone within twelve hours of `timeZone` therefore lands on the day that was
 *   picked, whether the employee's browser runs ahead of the zone the server reads (a Berlin browser in a UTC
 *   organization stores 23:00 UTC the day before) or behind it.
 * - An end stored as the last instant of its day (`23:59:59`, with or without milliseconds, in any zone) is that day.
 *
 * The request forms pick whole days, so a time of day carries no meaning of its own here.
 *
 * @returns the day, or `null` when the value is not a date.
 */
export function calendarDayOf(
	value: Date | string | null | undefined,
	timeZone?: string | null,
	bound: CalendarBound = 'start'
): CalendarDay | null {
	if (value === null || value === undefined || value === '') {
		return null;
	}
	if (typeof value === 'string' && DATE_ONLY.test(value)) {
		return moment.utc(value, DAY_FORMAT, true).isValid() ? value : null;
	}
	// A string is read as ISO 8601 (a SQL `YYYY-MM-DD HH:mm:ss` included), never through `Date`'s own guessing.
	const instant = typeof value === 'string' ? moment.utc(value, moment.ISO_8601) : moment.utc(value);
	if (!instant.isValid()) {
		return null;
	}
	const zone = knownTimeZone(timeZone);
	if (bound === 'end' && isEndOfDay(instant)) {
		// The last instant of a day: the next midnight, less that day.
		return nearestMidnight(instant.clone().add(1, 'second'), zone).subtract(1, 'day').format(DAY_FORMAT);
	}
	return nearestMidnight(instant, zone).format(DAY_FORMAT);
}

/**
 * The calendar days from `start` to `end`, both included, read in `timeZone` (see {@link calendarDayOf}).
 *
 * @returns the span; `null` when either bound is not a date or the request ends before it starts.
 */
export function calendarSpan(
	start: Date | string | null | undefined,
	end: Date | string | null | undefined,
	timeZone?: string | null
): ICalendarSpan | null {
	const first = calendarDayOf(start, timeZone, 'start');
	const last = calendarDayOf(end, timeZone, 'end');
	// Four-digit years only: a mistyped year 10000 is not a day this counting reads.
	if (!first || !last || !DATE_ONLY.test(first) || !DATE_ONLY.test(last) || last < first) {
		return null;
	}
	return { first, last, days: dayNumberOf(last) - dayNumberOf(first) + 1 };
}

/** The calendar years a span touches, earliest first. */
export function yearsOf({ first, last }: ICalendarSpan): number[] {
	const years: number[] = [];
	for (let year = yearOf(first); year <= yearOf(last); year++) {
		years.push(year);
	}
	return years;
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
	const span = calendarSpan(start, end, options.timeZone);
	if (!span) {
		return [];
	}
	const weekend = new Set(
		(options.weekendDays ?? DEFAULT_WEEKEND_DAYS).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
	);
	const first = dayNumberOf(span.first);
	const last = dayNumberOf(span.last);

	// Holidays on a working day, per year: only those inside the request, each counted once.
	const holidaysPerYear = new Map<number, number>();
	for (const day of holidayDaysWithin(options.holidays ?? [], span.first, span.last)) {
		const dayNumber = dayNumberOf(day);
		if (!weekend.has(weekdayOf(dayNumber))) {
			holidaysPerYear.set(yearOf(day), (holidaysPerYear.get(yearOf(day)) ?? 0) + 1);
		}
	}

	const result: IWorkingDaysOfYear[] = [];
	for (const year of yearsOf(span)) {
		const from = Math.max(first, dayNumberOf(`${pad(year, 4)}-01-01`));
		const to = Math.min(last, dayNumberOf(`${pad(year, 4)}-12-31`));
		const days = weekdaysBetween(from, to, weekend) - (holidaysPerYear.get(year) ?? 0);
		if (days > 0) {
			result.push({ year, days });
		}
	}
	return result;
}

/**
 * The days from `first` to `last`, both included, that are one of the holidays.
 *
 * A one-off holiday covers its own days. A recurring one covers the same month and day every year, the year it was
 * entered for included — the holiday listing's "falls in this year or recurs" — so a span across New Year
 * (31 December to 1 January) recurs as such. 29 February recurs in leap years only, and a recurring span that runs
 * from 28 February into March covers it in leap years even when it was entered in a common year.
 *
 * @returns the days, each once, earliest first.
 */
export function holidayDaysWithin(
	holidays: ReadonlyArray<ITimeOffHolidayDates>,
	first: CalendarDay,
	last: CalendarDay
): CalendarDay[] {
	const from = dayNumberOf(first);
	const to = dayNumberOf(last);
	if (!(to >= from)) {
		return [];
	}
	const days = new Set<number>();
	const recurring = new Set<string>();

	for (const holiday of holidays) {
		const start = storedDayOf(holiday.date);
		if (!start) {
			continue;
		}
		const end = storedDayOf(holiday.endDate);
		const startNumber = dayNumberOf(start);
		const endNumber = Math.min(
			end && end > start ? dayNumberOf(end) : startNumber,
			startNumber + MAX_HOLIDAY_SPAN_DAYS - 1
		);
		for (let day = startNumber; day <= endNumber; day++) {
			if (holiday.isRecurring) {
				recurring.add(dayOfNumber(day).slice(5));
			} else if (day >= from && day <= to) {
				days.add(day);
			}
		}
	}
	if (recurring.has('02-28') && recurring.has('03-01')) {
		recurring.add('02-29');
	}

	for (let year = yearOf(first); year <= yearOf(last) && recurring.size > 0; year++) {
		for (const monthDay of recurring) {
			const candidate = `${pad(year, 4)}-${monthDay}`;
			if (moment.utc(candidate, DAY_FORMAT, true).isValid()) {
				const day = dayNumberOf(candidate);
				if (day >= from && day <= to) {
					days.add(day);
				}
			}
		}
	}

	return [...days].sort((a, b) => a - b).map(dayOfNumber);
}

/**
 * The midnight nearest to `instant` in `zone`: the day it falls on before noon, the next day from noon on.
 */
function nearestMidnight(instant: Moment, zone: string): Moment {
	const local = instant.clone().tz(zone);
	const midnight = local.clone().startOf('day');
	return local.hours() >= 12 ? midnight.add(1, 'day') : midnight;
}

/**
 * Whether `instant` is the last second of a day in some zone (`23:59:59`, `23:59:59.999`). Zone offsets are whole
 * quarter hours, so in UTC its seconds read 59 and its minutes 14, 29, 44 or 59.
 */
function isEndOfDay(instant: Moment): boolean {
	const utc = instant.clone().utc();
	return utc.seconds() === 59 && utc.minutes() % 15 === 14;
}

/** Weekdays (days not in `weekend`) from day number `from` to `to`, both included: whole weeks, then the rest. */
function weekdaysBetween(from: number, to: number, weekend: ReadonlySet<number>): number {
	const total = to - from + 1;
	if (total <= 0) {
		return 0;
	}
	const weeks = Math.floor(total / 7);
	let count = weeks * (7 - weekend.size);
	for (let day = from + weeks * 7; day <= to; day++) {
		if (!weekend.has(weekdayOf(day))) {
			count++;
		}
	}
	return count;
}

/** Days since 1970-01-01 of a calendar day. */
function dayNumberOf(day: CalendarDay): number {
	return Math.round(
		Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) / MS_PER_DAY
	);
}

/** The calendar day of a day number. */
function dayOfNumber(dayNumber: number): CalendarDay {
	return moment.utc(dayNumber * MS_PER_DAY).format(DAY_FORMAT);
}

/** `0` = Sunday … `6` = Saturday; 1970-01-01 was a Thursday. */
function weekdayOf(dayNumber: number): number {
	return (((dayNumber + 4) % 7) + 7) % 7;
}

function yearOf(day: CalendarDay): number {
	return Number(day.slice(0, 4));
}

function pad(value: number, length: number): string {
	return String(value).padStart(length, '0');
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
