import moment from 'moment';
import { IDateRangePicker, ISelectedDateRange, ITimeLogFilters, WeekDaysEnum } from '@gauzy/contracts';
import { DateRangeKeyEnum, DateRanges, TimePeriod } from './date-picker.interface';

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
 * local, so subtracting the offset moves them — a day back on the START east of UTC (a pick of
 * 6–8 Oct became 5–8 Oct, "Today" became yesterday) and a day forward on the END west of it.
 * It also takes TODAY's offset, which is the wrong one for a day on the other side of a DST switch.
 * Read picker dates with {@link toLocalPickerMoment} / {@link toPickerRange}, which work for both
 * library generations. Kept for external callers of this exported helper.
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
 * A date object that can report its own wall-clock fields: the dayjs objects
 * `ngx-daterangepicker-material` emits, or a moment.
 */
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

/** A date as the picker library hands it out (a dayjs object), a moment, or a plain `Date`. */
export type PickerDate = WallClockDate | Date;

/**
 * Whether `value` is a date object exposing its wall-clock fields (dayjs or moment), not a `Date`.
 */
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
 * Reads a date coming out of `ngx-daterangepicker-material` as the LOCAL date and time the user
 * picked.
 *
 * The picked day lives in the WALL-CLOCK fields of the library's dayjs objects, but how they are
 * tagged changed between versions: 6.x emitted them tagged as UTC (a click on 25 Oct gave
 * 25 Oct 00:00Z, hence the old `shiftUTCtoLocal`), 22.x emits them local (25 Oct 00:00 local).
 * Rebuilding a local moment from those fields gives the picked day for both, for every UTC offset
 * and across DST switches — no offset arithmetic involved.
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
 * Turns the `datesUpdated` event of `ngx-daterangepicker-material` into the range the picker
 * selects: whole local days, or — on a locked picker — the whole unit of time containing the
 * picked start date.
 *
 * @param event The library's `{ startDate, endDate }`.
 * @param isLockDatePicker Whether the picker only allows one whole `unitOfTime`.
 * @param unitOfTime The unit a locked picker spans.
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
 * Brings a range written back through `[(ngModel)]` to the `Date`s `IDateRangePicker` promises.
 *
 * The library writes its OWN value back through the two-way binding: dayjs objects, which
 * `moment()` does not understand — `moment(dayjsObject)` silently yields TODAY at midnight. Each
 * pick therefore briefly put today into the URL, the timesheet filter and the date range builder
 * before `onDatesUpdated` overwrote it. Valid dayjs objects become the local `Date`s they stand
 * for; anything else (Dates, moments, strings, invalid dates) passes through, and a range with
 * nothing to convert keeps its identity.
 *
 * @param range The range as received by the `selectedDateRange` setter.
 * @returns The range with `Date` start and end dates.
 */
export function toPickerDateRange<T extends { startDate?: unknown; endDate?: unknown }>(range: T): T {
	if (!range) {
		return range;
	}

	const toDate = (value: unknown): unknown =>
		isWallClockDate(value) && !moment.isMoment(value) ? (toLocalPickerMoment(value)?.toDate() ?? value) : value;

	const startDate = toDate(range.startDate);
	const endDate = toDate(range.endDate);
	if (startDate === range.startDate && endDate === range.endDate) {
		return range;
	}
	return { ...range, startDate, endDate };
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

/** The units whose presets an unlocked picker offers, in the order the ranges menu lists them. */
export const PRESET_UNITS_OF_TIME: readonly moment.unitOfTime.Base[] = ['day', 'week', 'month', 'year'];

/**
 * The unit of time each preset spans. Picking a preset switches the picker to that unit, so the
 * arrows then step by it: a day after "Today", a whole year after "Current Year".
 */
export const PRESET_UNIT_OF_TIME: Readonly<Record<DateRangeKeyEnum, moment.unitOfTime.Base>> = {
	[DateRangeKeyEnum.TODAY]: 'day',
	[DateRangeKeyEnum.YESTERDAY]: 'day',
	[DateRangeKeyEnum.CURRENT_WEEK]: 'week',
	[DateRangeKeyEnum.LAST_WEEK]: 'week',
	[DateRangeKeyEnum.CURRENT_MONTH]: 'month',
	[DateRangeKeyEnum.LAST_MONTH]: 'month',
	[DateRangeKeyEnum.CURRENT_YEAR]: 'year',
	[DateRangeKeyEnum.LAST_YEAR]: 'year'
};

/** The "current" and "last" preset of each unit that has presets. */
const PRESETS_BY_UNIT: Partial<Record<moment.unitOfTime.Base, readonly [DateRangeKeyEnum, DateRangeKeyEnum]>> = {
	day: [DateRangeKeyEnum.TODAY, DateRangeKeyEnum.YESTERDAY],
	week: [DateRangeKeyEnum.CURRENT_WEEK, DateRangeKeyEnum.LAST_WEEK],
	month: [DateRangeKeyEnum.CURRENT_MONTH, DateRangeKeyEnum.LAST_MONTH],
	year: [DateRangeKeyEnum.CURRENT_YEAR, DateRangeKeyEnum.LAST_YEAR]
};

/**
 * Builds the preset ranges of the picker's menu: for each unit, the whole unit containing `now`
 * ("Today", "Current Week", …) and the whole unit before it ("Yesterday", "Last Week", …).
 *
 * A preset reaching past `maxDate` ends on `maxDate` instead, so on an organization that does not
 * allow future dates "Current Year" runs from 1 January to today rather than to 31 December.
 * Likewise a preset reaching back before `minDate` starts on `minDate`, and one that is over before
 * `minDate`'s day ("Yesterday", "Last Year", … where past dates are not allowed) is left out: the
 * picker would otherwise still list it, and picking it would give a range that ends before it starts.
 *
 * @param units The units to offer presets for; a unit without presets is skipped.
 * @param now The instant the presets are relative to.
 * @param maxDate The last selectable instant, or `null` when future dates are allowed.
 * @param minDate The first selectable instant, or `null` when past dates are allowed.
 * @returns The ranges keyed by their menu label, in the order of `units`.
 */
export function buildPresetRanges(
	units: readonly moment.unitOfTime.Base[],
	now: moment.Moment = moment(),
	maxDate: moment.Moment | null = null,
	minDate: moment.Moment | null = null
): DateRanges {
	const ranges: DateRanges = {};

	for (const unit of units) {
		const presets = PRESETS_BY_UNIT[unit];
		if (!presets) {
			continue;
		}

		const [currentKey, lastKey] = presets;
		const current = now.clone().startOf(unit);
		const last = current.clone().subtract(1, unit);

		addPreset(ranges, currentKey, wholeUnit(current, unit, maxDate), minDate);
		addPreset(ranges, lastKey, wholeUnit(last, unit, maxDate), minDate);
	}

	return ranges;
}

/** Adds `range` under `key`, starting on `minDate` at the earliest; a range over before `minDate`'s day is left out. */
function addPreset(
	ranges: DateRanges,
	key: DateRangeKeyEnum,
	[start, end]: [moment.Moment, moment.Moment],
	minDate: moment.Moment | null
): void {
	if (minDate && end.isBefore(minDate, 'day')) {
		return;
	}
	ranges[key] = [minDate && start.isBefore(minDate) ? minDate.clone() : start, end];
}

/** The whole `unit` starting at `start`, ending on `maxDate` at the latest. */
function wholeUnit(
	start: moment.Moment,
	unit: moment.unitOfTime.Base,
	maxDate: moment.Moment | null
): [moment.Moment, moment.Moment] {
	const end = start.clone().endOf(unit);
	return [start, maxDate && end.isAfter(maxDate) ? maxDate.clone() : end];
}
