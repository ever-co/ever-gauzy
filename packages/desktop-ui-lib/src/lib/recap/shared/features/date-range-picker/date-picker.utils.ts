import { ISelectedDateRange, ITimeLogFilters, WeekDaysEnum } from '@gauzy/contracts';
import * as momentDefault from 'moment';
import { extendMoment } from 'moment-range';
import { IDateRangePicker, TimePeriod } from './date-picker.interface';

export const moment = extendMoment(momentDefault);
/**
 * We are having issue, when organization not allowed future date
 * When someone run timer for today, all statistic not displaying correctly
 *
 * @returns
 */
export function getAdjustDateRangeFutureAllowed(request: ITimeLogFilters | IDateRangePicker): ISelectedDateRange {
	const now = moment();
	let { startDate, endDate } = request;
	/**
	 * If, user selected single day date range.
	 */
	if (moment(moment(startDate).format('YYYY-MM-DD')).isSame(moment(endDate).format('YYYY-MM-DD'))) {
		startDate = moment(startDate).startOf('day').utc().toDate();
		endDate = moment(endDate).endOf('day').utc().toDate();
	}

	/**
	 * If, user selected TODAY date range.
	 */
	if (moment(now.format('YYYY-MM-DD')).isSame(moment(endDate).format('YYYY-MM-DD'))) {
		endDate = moment().endOf('day').utc().toDate();
	}
	return {
		startDate: moment(startDate).toDate(),
		endDate: moment(endDate).toDate()
	} as ISelectedDateRange;
}

/**
 * Shifts a given time range from UTC to the local time zone.
 *
 * @deprecated Do not use it on dates from `ngx-daterangepicker-material` 22.x: they are already
 * local, so subtracting the offset moves them — a day back on the START east of UTC ("Today"
 * became yesterday, 6–8 Oct became 5–8 Oct) and a day forward on the END west of it. Read picker
 * dates with {@link toLocalPickerMoment} / {@link toPickerRange} instead.
 *
 * @param range The time range to be shifted.
 * @returns The shifted time range in the local time zone.
 */
export function shiftUTCtoLocal(range: TimePeriod): TimePeriod {
	if (range && range.endDate && range.startDate) {
		const offset = moment().utcOffset();
		return {
			startDate: moment(range.startDate.toDate()).subtract(offset, 'minute'),
			endDate: moment(range.endDate.toDate()).subtract(offset, 'minute')
		};
	} else {
		return range;
	}
}

/** A date object that can report its own wall-clock fields: the library's dayjs objects, or a moment. */
export interface WallClockDate {
	isValid(): boolean;
	year(): number;
	month(): number;
	date(): number;
	hour(): number;
	minute(): number;
	second(): number;
	millisecond(): number;
}

/** A date as `ngx-daterangepicker-material` hands it out (a dayjs object), a moment, or a plain `Date`. */
export type PickerDate = WallClockDate | Date;

/** Whether `value` is a date object exposing its wall-clock fields (dayjs or moment), not a `Date`. */
export function isWallClockDate(value: unknown): value is WallClockDate {
	if (!value || typeof value !== 'object' || value instanceof Date) {
		return false;
	}
	const candidate = value as Record<keyof WallClockDate, unknown>;
	return (['isValid', 'year', 'month', 'date', 'hour', 'minute', 'second', 'millisecond'] as const).every(
		(method) => typeof candidate[method] === 'function'
	);
}

/**
 * Reads a date coming out of `ngx-daterangepicker-material` as the LOCAL date and time the user picked.
 *
 * The picked day lives in the WALL-CLOCK fields of the library's dayjs objects; 6.x tagged them as UTC,
 * 22.x tags them local. Rebuilding a local moment from those fields gives the picked day for both, for
 * every UTC offset and across DST switches. Mirrors the helper of the web date range picker
 * (`@gauzy/ui-core/shared`).
 *
 * @param date A dayjs object or moment (read by its wall clock), or a `Date` (taken as is).
 * @returns The local moment, or `null` for a missing or invalid date.
 */
export function toLocalPickerMoment(date: PickerDate | null | undefined): moment.Moment | null {
	if (date instanceof Date) {
		const local = moment(date);
		return local.isValid() ? local : null;
	}
	if (!isWallClockDate(date) || !date.isValid()) {
		return null;
	}
	return moment([
		date.year(),
		date.month(),
		date.date(),
		date.hour(),
		date.minute(),
		date.second(),
		date.millisecond()
	]);
}

/**
 * Turns the `datesUpdated` event of `ngx-daterangepicker-material` into the range the picker selects:
 * whole local days, or — on a locked picker — the whole unit of time containing the picked start date.
 *
 * @returns The local start and end moments, or `null` when either date is missing or invalid.
 */
export function toPickerRange(
	event: { startDate?: PickerDate | null; endDate?: PickerDate | null } | null | undefined,
	isLockDatePicker: boolean,
	unitOfTime: moment.unitOfTime.Base
): TimePeriod | null {
	const startDate = toLocalPickerMoment(event?.startDate);
	const endDate = toLocalPickerMoment(event?.endDate);
	if (!startDate || !endDate) {
		return null;
	}

	if (isLockDatePicker) {
		return {
			startDate: startDate.clone().startOf(unitOfTime),
			endDate: startDate.clone().endOf(unitOfTime)
		};
	}

	return {
		startDate: startDate.clone().startOf('day'),
		endDate: endDate.clone().endOf('day')
	};
}

/**
 * Converts a day string to a day number.
 *
 * @param {String} weekDay
 * @return {Number} Returns day index as number
 */
export function dayOfWeekAsString(weekDay: WeekDaysEnum): number {
	return [
		WeekDaysEnum.SUNDAY,
		WeekDaysEnum.MONDAY,
		WeekDaysEnum.TUESDAY,
		WeekDaysEnum.WEDNESDAY,
		WeekDaysEnum.THURSDAY,
		WeekDaysEnum.FRIDAY,
		WeekDaysEnum.SATURDAY
	].indexOf(weekDay);
}

/**
 * Updates the week days based on the specified start and end dates.
 * If no dates are provided in the request, it defaults to the current week.
 */
export function updateWeekDays(input: IDateRangePicker) {
	const { startDate = moment().startOf('week'), endDate = moment().endOf('week') } = input;

	const start = moment(moment(startDate).format('YYYY-MM-DD'));
	const end = moment(moment(endDate).format('YYYY-MM-DD'));
	const range = Array.from(moment.range(start, end).by('day'));
	const weekDays = range.map((date: moment.Moment) => date.format('YYYY-MM-DD'));

	return { range, weekDays };
}

export function updateMonthWeeks(input: IDateRangePicker) {
	const { range } = updateWeekDays(input);
	const monthWeeks = range.map((date) => ({
		day: date.format('YYYY-MM-DD'),
		week: moment(date).week()
	}));
	const monthWeekdays = monthWeeks.reduce((acc, curr) => {
		const weekNumber = curr.week;

		let weekObj = acc.find((item) => item.week === weekNumber);

		if (!weekObj) {
			weekObj = { week: weekNumber, days: [] };
			acc.push(weekObj);
		}

		weekObj.days.push(curr.day);

		return acc;
	}, []);
	return { monthWeekdays };
}

export function weekDateRange(weekNumber: number): string {
	const startOfWeek = moment().week(weekNumber).startOf('week');
	const endOfWeek = moment().week(weekNumber).endOf('week');

	return `${startOfWeek.format('MMM Do')} - ${endOfWeek.format('MMM Do')}`;
}
