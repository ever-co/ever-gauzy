/**
 * Due dates name a calendar day. The platform stores such a day in its date-only form, midnight UTC of that day (as
 * the integrations write a provider's day and the bulk task update writes a picked day), and a bare `YYYY-MM-DD` means
 * the same. Every reader shows that day whatever its own zone. Any other value is a moment, read in the reader's zone.
 */

const BARE_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The platform's date-only form of a calendar day: midnight UTC of it. `month` counts from 0, as `Date` does. */
export function dateOnlyOf(year: number, month: number, day: number): Date {
	return new Date(Date.UTC(year, month, day));
}

/** The calendar day a date-only value names (`[year, month from 0, day]`), or null for a moment or no date. */
export function dayOfDateOnly(value: Date | string | null | undefined): [number, number, number] | null {
	if (value === null || value === undefined || value === '') return null;
	if (typeof value === 'string') {
		const bare = BARE_DAY.exec(value.trim());
		if (bare) return [Number(bare[1]), Number(bare[2]) - 1, Number(bare[3])];
	}
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	const midnightUtc =
		date.getUTCHours() === 0 &&
		date.getUTCMinutes() === 0 &&
		date.getUTCSeconds() === 0 &&
		date.getUTCMilliseconds() === 0;
	return midnightUtc ? [date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()] : null;
}

/**
 * A stored due date as a date pipe formats it: a date-only value as the start of that day in the reader's own zone,
 * so every reader sees the same day (Angular's `date` and the platform's `dateFormat` alike); a moment as it is.
 */
export function dueDateShown(value: Date | string | null | undefined): Date | string | null {
	if (value === null || value === undefined || value === '') return null;
	const day = dayOfDateOnly(value);
	return day ? new Date(day[0], day[1], day[2]) : value;
}

/**
 * The last instant a task is due by, in milliseconds: for a date-only due date, the end of that day in the reader's
 * zone (it is not late on its own day); for a moment, that moment. Null for no date or an unreadable one.
 */
export function dueDeadline(value: Date | string | null | undefined): number | null {
	const day = dayOfDateOnly(value);
	if (day) return new Date(day[0], day[1], day[2], 23, 59, 59, 999).getTime();
	if (value === null || value === undefined || value === '') return null;
	const time = new Date(value).getTime();
	return Number.isFinite(time) ? time : null;
}
