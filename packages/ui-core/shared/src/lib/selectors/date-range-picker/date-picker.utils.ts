import moment from 'moment';
import { IDateRangePicker, ISelectedDateRange, ITimeLogFilters, WeekDaysEnum } from '@gauzy/contracts';
import { TimePeriod } from './date-picker.interface';

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
