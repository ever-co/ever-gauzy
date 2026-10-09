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

/** The inputs the header picker weighs when deciding which unit of time to run at. */
export interface UnitOfTimeSelection {
	/**
	 * Whether the date picker configuration differs BY REFERENCE from the one already applied.
	 * The configuration object is rebuilt once per route RESOLUTION, so this means "a new route
	 * settled" rather than "an organization or timezone re-emission woke the pipeline".
	 */
	isNewRouteConfig: boolean;
	/** The unit the resolved configuration carries. */
	routeUnitOfTime: moment.unitOfTime.Base;
	/** `unit_of_time` from the URL, when it carries one. */
	queryUnitOfTime?: moment.unitOfTime.Base;
	/** The unit the picker is on right now. */
	currentUnitOfTime?: moment.unitOfTime.Base;
}

/**
 * Decides which unit of time the header picker should run at, or `null` to leave it alone.
 *
 * The route and the URL each carry a unit, and they disagree during a route transition:
 * `route.queryParams` emits BEFORE the new route's configuration reaches the picker, so for one
 * turn the OLD configuration is paired with the new URL. Letting the URL win there is what used to
 * leave day-locked pages on 'week' — the picker derived with the stale unit, wrote it back into the
 * URL, and the URL then outranked every configuration that arrived afterwards.
 *
 * @param selection The route/URL/current units and whether the configuration is newly resolved.
 * @returns The unit to apply, or `null` when neither input has anything new to say.
 */
export function selectUnitOfTime({
	isNewRouteConfig,
	routeUnitOfTime,
	queryUnitOfTime,
	currentUnitOfTime
}: UnitOfTimeSelection): moment.unitOfTime.Base | null {
	// A freshly resolved configuration is authoritative: the resolver has already folded the URL's
	// `unit_of_time` into it, honouring it only on routes that let the user change the unit.
	if (isNewRouteConfig) {
		return routeUnitOfTime;
	}

	// Between resolutions the URL is the in-page signal — a range the user picked from the menu, or
	// history stepping back to one. Ignoring a value equal to the current unit drops the picker's
	// own echo of what it just wrote, and with it a pointless re-derivation and re-write.
	if (queryUnitOfTime && queryUnitOfTime !== currentUnitOfTime) {
		return queryUnitOfTime;
	}

	return null;
}
