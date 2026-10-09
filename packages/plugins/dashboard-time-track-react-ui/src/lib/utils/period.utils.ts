import moment from 'moment-timezone';
import { IDateRangePicker, IOrganization } from '@gauzy/contracts';

/**
 * Coarse shape of the selected date range — a mirror of the Angular `RangePeriod` enum in
 * `dashboard-time-track-angular-ui/.../time-tracking.component.ts` (same string values, so the
 * two flavours can share persisted state and i18n suffixes).
 */
export enum RangePeriod {
	DAY = 'DAY',
	WEEK = 'WEEK',
	PERIOD = 'PERIOD'
}

/** Identity of the six counter widgets (array index in the default order = `position`). */
export enum Widgets {
	MEMBERS_WORKED = 0,
	PROJECTS_WORKED = 1,
	TODAY_ACTIVITY = 2,
	WORKED_TODAY = 3,
	WORKED_THIS_WEEK = 4,
	WEEKLY_ACTIVITY = 5
}

/** Identity of the six windows — same enum as the Angular `Windows`. */
export enum Windows {
	RECENT_ACTIVITIES = 0,
	MANUAL_TIMES = 1,
	TASKS = 2,
	PROJECTS = 3,
	APPS_URLS = 4,
	MEMBERS = 5
}

/** Number of counter widgets / windows the dashboard has. */
export const WIDGET_COUNT = 6;
export const WINDOW_COUNT = 6;

/** A start/end pair; both Angular `IDateRangePicker` and the API payload shapes satisfy it. */
export type DateRangeLike = Pick<IDateRangePicker, 'startDate' | 'endDate'> & { isCustomDate?: boolean };

/**
 * Whole days between the two ends of a range (`moment.diff(..., 'days')`, truncating).
 */
function daysBetween(range: DateRangeLike): number {
	return moment(range.endDate).diff(moment(range.startDate), 'days');
}

/**
 * Detects the range period EXACTLY like Angular's `selectedPeriod` getter: a span of exactly
 * six days is a WEEK, zero days is a DAY, anything else (including 1–5 days) is a PERIOD.
 *
 * @param range Selected range; `undefined` yields `undefined` (Angular returns nothing before a
 * range exists).
 */
export function resolveRangePeriod(range?: DateRangeLike | null): RangePeriod | undefined {
	if (!range) return undefined;
	const days = daysBetween(range);
	if (days === 6) return RangePeriod.WEEK;
	if (days === 0) return RangePeriod.DAY;
	return RangePeriod.PERIOD;
}

/**
 * True when the range is exactly the current calendar week (moment locale week boundaries),
 * compared on the `YYYY-MM-DD` day like Angular's `isCurrentWeek()`.
 *
 * @param range Selected range.
 * @param now Injectable "now" for tests.
 */
export function isCurrentWeek(range?: DateRangeLike | null, now: moment.Moment = moment()): boolean {
	if (!range) return false;
	return (
		moment(range.startDate).format('YYYY-MM-DD') === now.clone().startOf('week').format('YYYY-MM-DD') &&
		moment(range.endDate).format('YYYY-MM-DD') === now.clone().endOf('week').format('YYYY-MM-DD')
	);
}

/** Angular `isMoreThanDays()`: the range spans more than one day. */
export function isMoreThanDays(range?: DateRangeLike | null): boolean {
	if (!range?.startDate || !range?.endDate) return false;
	return daysBetween(range) > 0;
}

/** Angular `isMoreThanWeek()`: the range spans more than one week. */
export function isMoreThanWeek(range?: DateRangeLike | null): boolean {
	if (!range?.startDate || !range?.endDate) return false;
	return moment(range.endDate).diff(moment(range.startDate), 'weeks') > 0;
}

/**
 * The i18n key of the title prefix ("Daily" / "Weekly" / "Monthly"), mirroring Angular's
 * `headerTitle` getter: no range → WEEKLY; a custom range → no prefix (`null`); otherwise by
 * span.
 *
 * @param range Selected range.
 */
export function headerTitleKey(range?: DateRangeLike | null): string | null {
	if (!range) return 'TIMESHEET.WEEKLY';
	const { startDate, endDate, isCustomDate } = range;
	if (startDate && endDate && !isCustomDate) {
		if (isMoreThanWeek(range)) return 'TIMESHEET.MONTHLY';
		if (isMoreThanDays(range)) return 'TIMESHEET.WEEKLY';
		return 'TIMESHEET.DAILY';
	}
	return null;
}

/**
 * The capacity (in seconds) the "Worked today/this week" dot strips are measured against —
 * Angular's `period` getter: days in range × the organization's working day (or 24h when the
 * org has no start/end time) × the number of employees who worked.
 *
 * @param range Selected range.
 * @param organization Organization carrying `defaultStartTime` / `defaultEndTime` (`HH:mm`).
 * @param employeesCount `counts.employeesCount`; `undefined` (counts not loaded) → `undefined`.
 */
export function periodCapacity(
	range: DateRangeLike | null | undefined,
	organization: Pick<IOrganization, 'defaultStartTime' | 'defaultEndTime'> | null | undefined,
	employeesCount: number | undefined
): number | undefined {
	if (!range?.startDate || !range?.endDate || employeesCount === undefined || employeesCount === null) return undefined;
	// A missing work time must mean "a full day", not "now" (`moment(undefined, 'HH:mm')` is the
	// current time, which would shrink the capacity to ~0).
	const startWork = organization?.defaultStartTime ? moment(organization.defaultStartTime, 'HH:mm', true) : null;
	const endWork = organization?.defaultEndTime ? moment(organization.defaultEndTime, 'HH:mm', true) : null;
	const workDay =
		startWork?.isValid() && endWork?.isValid() && endWork.isAfter(startWork) ? endWork.diff(startWork) / 1000 : 86400;
	const dayCount = daysBetween(range) + 1;
	return dayCount * workDay * employeesCount;
}

/** Window titles by position (Angular `titleMapper(position, false)`). */
export const WINDOW_TITLE_KEYS: readonly string[] = [
	'TIMESHEET.RECENT_ACTIVITIES',
	'TIMESHEET.MANUAL_TIME',
	'TIMESHEET.TASKS',
	'TIMESHEET.PROJECTS',
	'TIMESHEET.APPS_URLS',
	'TIMESHEET.MEMBERS'
];

/**
 * Widget titles by position for a given period (Angular `titleMapper(position, true)`).
 *
 * Positions 4 and 5 are period-aware: "Worked over the period" / "Activity over the period" for
 * a PERIOD, "…for the day" for a DAY, and "Worked this week" (current week) or "Worked for the
 * week" + "Weekly Activity" otherwise. Angular's array literally repeats MEMBERS_WORKED at 4/5
 * before the switch overwrites them; the switch always overwrites, so the defaults are the WEEK
 * keys here.
 *
 * @param period Detected period (undefined → WEEK branch, like Angular's `default`).
 * @param currentWeek Whether the range is the current week.
 */
export function widgetTitleKeys(period: RangePeriod | undefined, currentWeek: boolean): string[] {
	const keys = [
		'TIMESHEET.MEMBERS_WORKED',
		'TIMESHEET.PROJECTS_WORKED',
		'TIMESHEET.TODAY_ACTIVITY',
		'TIMESHEET.WORKED_TODAY',
		currentWeek ? 'TIMESHEET.WORKED_THIS_WEEK' : 'TIMESHEET.WORKED_FOR_WEEK',
		'TIMESHEET.ACTIVITY_FOR_WEEK'
	];
	switch (period) {
		case RangePeriod.PERIOD:
			keys[4] = 'TIMESHEET.WORKED_OVER_PERIOD';
			keys[5] = 'TIMESHEET.ACTIVITY_OVER_PERIOD';
			break;
		case RangePeriod.DAY:
			keys[4] = 'TIMESHEET.WORKED_FOR_DAY';
			keys[5] = 'TIMESHEET.ACTIVITY_FOR_DAY';
			break;
		default:
			break;
	}
	return keys;
}

/**
 * Angular `titleMapper(position, isWidget)`.
 *
 * @param position Widget/window position (0–5).
 * @param isWidget Widget titles when true, window titles otherwise.
 * @param period Detected period.
 * @param currentWeek Whether the range is the current week.
 */
export function titleMapper(position: number, isWidget: boolean, period: RangePeriod | undefined, currentWeek: boolean): string {
	return isWidget ? widgetTitleKeys(period, currentWeek)[position] : WINDOW_TITLE_KEYS[position];
}

/**
 * Builds the period-suffixed empty-state key, e.g. `emptyMessageKey('TIMESHEET.NO_SCREENSHOT', WEEK)`
 * → `TIMESHEET.NO_SCREENSHOT_WEEK`. Angular renders nothing when the period is unknown; this
 * falls back to the WEEK message so a stale-range render still says something.
 *
 * @param baseKey Key prefix without the period suffix.
 * @param period Detected period.
 */
export function emptyMessageKey(baseKey: string, period: RangePeriod | undefined): string {
	return `${baseKey}_${period ?? RangePeriod.WEEK}`;
}
