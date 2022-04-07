import * as moment from 'moment';
import { IDateRangePicker, ISelectedDateRange, ITimeLogFilters } from "@gauzy/contracts";
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