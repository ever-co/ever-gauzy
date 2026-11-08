import * as moment from 'moment';

/** From UTC-12 to UTC+14, the current day of every time zone is at most one day away from the UTC date. */
const MAX_DAYS_FROM_UTC_DATE = 1;

/**
 * The caller's current day, as `YYYY-MM-DD`, when `value` is a valid day that is today somewhere. Plans are stored
 * on the user's own calendar day, which the API cannot tell from the time alone. Any other value gives null, so a
 * client cannot name an arbitrary day.
 *
 * @param value The day the caller sent.
 * @param now The server's current time.
 */
export function dayIfTodaySomewhere(value: unknown, now: moment.Moment = moment.utc()): string | null {
	if (typeof value !== 'string') {
		return null;
	}

	const utcToday = now.clone().utc().startOf('day');
	const callerDay = moment.utc(value, 'YYYY-MM-DD', true);
	const isValidDay = callerDay.isValid();
	const daysFromUtcToday = callerDay.diff(utcToday, 'days');
	const distanceInDays = Math.abs(daysFromUtcToday);
	const isTodaySomewhere = distanceInDays <= MAX_DAYS_FROM_UTC_DATE;
	const isCallerToday = isValidDay && isTodaySomewhere;

	if (!isCallerToday) {
		return null;
	}

	return callerDay.format('YYYY-MM-DD');
}
