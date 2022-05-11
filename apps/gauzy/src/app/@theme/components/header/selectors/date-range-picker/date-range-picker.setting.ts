import * as moment from 'moment';
import { IDateRangePicker, ISelectedDateRange, ITimeLogFilters, WeekDaysEnum } from "@gauzy/contracts";

export enum DateRangeKeyEnum {
	TODAY = 'Today',
	YESTERDAY = 'Yesterday',
	CURRENT_WEEK = 'Current week',
	LAST_WEEK = 'Last week',
	CURRENT_MONTH = 'Current month',
	LAST_MONTH = 'Last month'
}

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
    if (
        moment(moment(startDate).format('YYYY-MM-DD')).isSame(
            moment(endDate).format('YYYY-MM-DD')
        )
    ) {
        startDate = moment(startDate).startOf('day').utc().toDate();
        endDate = moment(endDate).endOf('day').utc().toDate();
    }

    /**
     * If, user selected TODAY date range.
     */
    if (
        moment(now.format('YYYY-MM-DD')).isSame(
            moment(endDate).format('YYYY-MM-DD')
        )
    ) {
        endDate = moment.utc().toDate();
    }
    return {
        startDate: moment(startDate).toDate(),
        endDate: moment(endDate).toDate()
    } as ISelectedDateRange
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
 * GET date range picker raw values only
 * 
 * @param range 
 * @returns 
 */
export function getRawValuesFromRangePicker(
    range: IDateRangePicker
): ISelectedDateRange {
    let { startDate, endDate } = range;
    return {
        startDate: startDate,
        endDate: endDate
    }
}