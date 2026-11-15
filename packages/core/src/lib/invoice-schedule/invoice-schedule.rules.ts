import { IInvoiceSchedulePeriod, InvoiceScheduleFrequencyEnum } from '@gauzy/contracts';

/**
 * The rules of a billing schedule's periods, on calendar days (`YYYY-MM-DD`) of the organization's time zone. A day is
 * not an instant: the same key means the same day in every zone, and the sweep reads "today" in the organization's own.
 *
 * Periods follow each other from the schedule's start day, with no gap and no overlap: every week, every two weeks, or
 * every month. A monthly period ends the day before the same day of the next month, counted from the start day each
 * time, so a schedule started on the 31st never drifts: its periods run to the day before the 28th, 29th, 30th or 31st
 * its month has. The invoice of a period is made on the day after it: its run day.
 */

/** How many days after its run day a period's invoice is still made: a sweep that did not run for a while catches up. */
export const INVOICE_SCHEDULE_CATCH_UP_DAYS = 7;

/** The schedule fields the periods are counted from. */
export interface IInvoiceScheduleTimeline {
	frequency: InvoiceScheduleFrequencyEnum;
	startDay: string;
}

/** A period, with its rank among the schedule's periods (0 for the first). */
export interface IRankedInvoiceSchedulePeriod extends IInvoiceSchedulePeriod {
	index: number;
}

const DAY_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_PER_WEEK = 7;

/** The length in days of the periods of a frequency counted in days; null for a monthly one. */
function periodDaysOf(frequency: InvoiceScheduleFrequencyEnum): number | null {
	switch (frequency) {
		case InvoiceScheduleFrequencyEnum.WEEKLY:
			return DAYS_PER_WEEK;
		case InvoiceScheduleFrequencyEnum.BIWEEKLY:
			return 2 * DAYS_PER_WEEK;
		default:
			return null;
	}
}

/** The day key's midnight in UTC, in milliseconds; NaN for a text that is not a day key. */
function utcOf(dayKey: string): number {
	const match = DAY_KEY_PATTERN.exec(dayKey ?? '');
	if (!match) {
		return Number.NaN;
	}
	return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** The day key of a UTC midnight. */
function dayKeyOfUtc(utc: number): string {
	return new Date(utc).toISOString().slice(0, 10);
}

/** Whether a text is a day that exists, `YYYY-MM-DD` (2026-02-30 is not one). */
export function isRealDay(dayKey: unknown): dayKey is string {
	if (typeof dayKey !== 'string') {
		return false;
	}
	const utc = utcOf(dayKey);
	return Number.isFinite(utc) && dayKeyOfUtc(utc) === dayKey;
}

/** The day `days` after a day (before it, for a negative count). */
export function addDaysToDay(dayKey: string, days: number): string {
	return dayKeyOfUtc(utcOf(dayKey) + days * MS_PER_DAY);
}

/** How many days the second day comes after the first (negative when it comes before). */
export function daysBetween(fromDay: string, toDay: string): number {
	return Math.round((utcOf(toDay) - utcOf(fromDay)) / MS_PER_DAY);
}

/**
 * The same day `months` months later, or the last day of that month when it has fewer days: 2026-01-31 plus one month
 * is 2026-02-28.
 */
export function addMonthsToDay(dayKey: string, months: number): string {
	const [year, month, day] = dayKey.split('-').map(Number);
	const monthIndex = year * 12 + (month - 1) + months;
	const targetYear = Math.floor(monthIndex / 12);
	const targetMonth = monthIndex % 12;
	const daysInTarget = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
	return dayKeyOfUtc(Date.UTC(targetYear, targetMonth, Math.min(day, daysInTarget)));
}

/** The first day of the period of that rank. */
function periodStartOf(timeline: IInvoiceScheduleTimeline, index: number): string {
	const periodDays = periodDaysOf(timeline.frequency);
	if (periodDays === null) {
		return addMonthsToDay(timeline.startDay, index);
	}
	return addDaysToDay(timeline.startDay, index * periodDays);
}

/**
 * The period of that rank: from its first day to the day before the next period starts, and its run day.
 *
 * @param timeline The schedule's frequency and start day.
 * @param index The period's rank, 0 for the first.
 */
export function periodAt(timeline: IInvoiceScheduleTimeline, index: number): IRankedInvoiceSchedulePeriod {
	const startDay = periodStartOf(timeline, index);
	const runDay = periodStartOf(timeline, index + 1);
	return { index, startDay, endDay: addDaysToDay(runDay, -1), runDay };
}

/**
 * The rank of the last period whose run day has come by `day`, or -1 when none has: the first period's run day is
 * still ahead.
 */
function lastRunRankBy(timeline: IInvoiceScheduleTimeline, day: string): number {
	const periodDays = periodDaysOf(timeline.frequency);
	if (periodDays !== null) {
		const elapsedDays = daysBetween(timeline.startDay, day);
		return Math.floor(elapsedDays / periodDays) - 1;
	}
	const [startYear, startMonth] = timeline.startDay.split('-').map(Number);
	const [year, month] = day.split('-').map(Number);
	// The month count, one lower when this month's run day is still ahead
	let elapsedMonths = (year - startYear) * 12 + (month - startMonth);
	if (addMonthsToDay(timeline.startDay, elapsedMonths) > day) {
		elapsedMonths -= 1;
	}
	return elapsedMonths - 1;
}

/**
 * The last period whose run day has come by `day`, that day included; null while the first run day is still ahead.
 *
 * @param timeline The schedule's frequency and start day.
 * @param day A day of the organization's time zone, `YYYY-MM-DD`.
 */
export function lastRunPeriodBy(timeline: IInvoiceScheduleTimeline, day: string): IRankedInvoiceSchedulePeriod | null {
	const rank = lastRunRankBy(timeline, day);
	if (rank < 0) {
		return null;
	}
	return periodAt(timeline, rank);
}

/**
 * The first period whose run day is after `day`.
 *
 * @param timeline The schedule's frequency and start day.
 * @param day A day of the organization's time zone, `YYYY-MM-DD`.
 */
export function firstPeriodRunAfter(timeline: IInvoiceScheduleTimeline, day: string): IRankedInvoiceSchedulePeriod {
	const rank = Math.max(lastRunRankBy(timeline, day) + 1, 0);
	return periodAt(timeline, rank);
}

/**
 * The period whose invoice is due today, if any: the last one whose run day has come, unless that day was before the
 * schedule ran (`activeSinceDay`: its creation or its last resume, so the past is never billed), or more than
 * {@link INVOICE_SCHEDULE_CATCH_UP_DAYS} days ago. Only the last period is ever due, so a sweep that did not run for a
 * while, or a start day in the past, makes one invoice at most, never a burst.
 *
 * @param timeline The schedule's frequency and start day.
 * @param today Today in the organization's time zone, `YYYY-MM-DD`.
 * @param activeSinceDay The day the schedule started running, in the organization's time zone.
 */
export function duePeriodOf(
	timeline: IInvoiceScheduleTimeline,
	today: string,
	activeSinceDay: string
): IRankedInvoiceSchedulePeriod | null {
	const period = lastRunPeriodBy(timeline, today);
	if (!period) {
		return null;
	}
	const ranBeforeSchedule = period.runDay < activeSinceDay;
	const isTooLate = daysBetween(period.runDay, today) > INVOICE_SCHEDULE_CATCH_UP_DAYS;
	if (ranBeforeSchedule || isTooLate) {
		return null;
	}
	return period;
}

/**
 * The next period the schedule will bill: the period due today when it has not been billed yet, else the first one
 * whose run day is ahead.
 *
 * @param timeline The schedule's frequency and start day.
 * @param today Today in the organization's time zone, `YYYY-MM-DD`.
 * @param activeSinceDay The day the schedule started running, in the organization's time zone.
 * @param isBilled Whether a run of the period starting on that day was already made.
 */
export function nextPeriodOf(
	timeline: IInvoiceScheduleTimeline,
	today: string,
	activeSinceDay: string,
	isBilled: (periodStart: string) => boolean
): IRankedInvoiceSchedulePeriod {
	const due = duePeriodOf(timeline, today, activeSinceDay);
	if (due && !isBilled(due.startDay)) {
		return due;
	}
	return firstPeriodRunAfter(timeline, today);
}

/** The schedule's period as the API answers it, without its rank. */
export function periodView(period: IRankedInvoiceSchedulePeriod): IInvoiceSchedulePeriod {
	return { startDay: period.startDay, endDay: period.endDay, runDay: period.runDay };
}
