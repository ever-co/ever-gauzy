import * as moment from 'moment';
// Type-only import keeps this module free of cross-package runtime dependencies,
// so it stays trivially unit-testable.
import type { IDashboardWidgetContext } from '@gauzy/ui-core/core';

/**
 * Granularity of the selected reporting window.
 *
 * Mirrors the `RangePeriod` enum declared on the legacy `TimeTrackingComponent`.
 * It is re-declared here on purpose: importing it from the component file would
 * drag the whole (eagerly-styled, Swiper-registering) dashboard component into
 * every lazily loaded widget chunk.
 */
export enum RangePeriod {
	DAY = 'DAY',
	WEEK = 'WEEK',
	PERIOD = 'PERIOD'
}

/** Seconds in a full day, used when the organization has no working hours configured. */
const SECONDS_IN_DAY = 86400;

// NOTE: request shaping for `/timesheet/statistics/*` deliberately lives in
// `TimesheetStatisticsCacheService.buildStatisticsRequest` (@gauzy/ui-core/core)
// and must NOT be duplicated here — it applies the organization's UTC offset,
// and a second, offset-free implementation is exactly what makes a canvas widget
// disagree with the standard Time Tracking page about the same numbers.

/**
 * Classifies the selected date range as a single day, a week, or an arbitrary period.
 *
 * @param context The ambient dashboard widget context.
 * @returns The matching {@link RangePeriod}; defaults to `WEEK` when unknown.
 */
export function resolveRangePeriod(context: IDashboardWidgetContext | null): RangePeriod {
	if (!context?.startDate || !context?.endDate) {
		return RangePeriod.WEEK;
	}

	const days = moment(context.endDate).diff(moment(context.startDate), 'days');

	if (days === 0) {
		return RangePeriod.DAY;
	}
	if (days === 6) {
		return RangePeriod.WEEK;
	}
	return RangePeriod.PERIOD;
}

/**
 * Whether the selected range is exactly the current calendar week.
 *
 * Drives the "Worked this week" vs "Worked for the week" title, matching the
 * legacy dashboard wording.
 *
 * @param context The ambient dashboard widget context.
 * @returns True when the range spans the current week.
 */
export function isCurrentWeekRange(context: IDashboardWidgetContext | null): boolean {
	if (!context?.startDate || !context?.endDate) {
		return false;
	}

	return (
		moment(context.startDate).format('YYYY-MM-DD') === moment().startOf('week').format('YYYY-MM-DD') &&
		moment(context.endDate).format('YYYY-MM-DD') === moment().endOf('week').format('YYYY-MM-DD')
	);
}

/**
 * Whether the selected range spans more than one calendar week.
 *
 * Replicates `TimeTrackingComponent.isMoreThanWeek()`: the Members panel only
 * draws its per-day bar graph for ranges up to a week, because beyond that the
 * seven bars stop mapping onto seven real days.
 *
 * @param context The ambient dashboard widget context.
 * @returns True when the range is longer than a week.
 */
export function isMoreThanWeekRange(context: IDashboardWidgetContext | null): boolean {
	if (!context?.startDate || !context?.endDate) {
		return false;
	}

	return moment(context.endDate).diff(moment(context.startDate), 'weeks') > 0;
}

/**
 * Total number of workable seconds in the selected range across all members.
 *
 * Used as the denominator ("total") of the duration counters so the coloured
 * points represent progress against capacity rather than against a fixed day.
 * Replicates `TimeTrackingComponent.period`.
 *
 * @param context The ambient dashboard widget context.
 * @param employeesCount Number of members that logged time in the range.
 * @returns The capacity in seconds; `0` when it cannot be derived.
 */
export function resolvePeriodSeconds(context: IDashboardWidgetContext | null, employeesCount: number): number {
	if (!context?.startDate || !context?.endDate) {
		return 0;
	}

	const dayCount = moment(context.endDate).diff(moment(context.startDate), 'days') + 1;

	return dayCount * resolveWorkingSeconds(context) * (employeesCount || 0);
}

/**
 * Working seconds in one day for the context's organization.
 *
 * Both ends have to be present AND parse: `moment(undefined, 'HH:mm')` yields
 * the CURRENT time rather than an invalid date, so an organization with no
 * configured hours would produce a near-zero capacity instead of reaching the
 * documented full-day fallback.
 *
 * @param context The ambient dashboard widget context.
 * @returns Seconds of capacity per day, falling back to a full day.
 */
function resolveWorkingSeconds(context: IDashboardWidgetContext): number {
	const { defaultStartTime, defaultEndTime } = context.organization ?? {};
	if (!defaultStartTime || !defaultEndTime) {
		return SECONDS_IN_DAY;
	}

	const startWork = moment(defaultStartTime, 'HH:mm', true);
	const endWork = moment(defaultEndTime, 'HH:mm', true);
	if (!startWork.isValid() || !endWork.isValid()) {
		return SECONDS_IN_DAY;
	}

	const workingSeconds = endWork.diff(startWork) / 1000;
	return Number.isNaN(workingSeconds) || workingSeconds <= 0 ? SECONDS_IN_DAY : workingSeconds;
}

/**
 * Stable fingerprint of everything a `/timesheet/statistics/*` request depends on.
 *
 * Used as the `distinctUntilChanged` comparator of the list widgets, so a
 * context change that CANNOT affect the response — a new `organization` object
 * identity after an unrelated store write, a currency or time-format switch —
 * does not re-run the fetch. The fields are exactly the ones
 * `buildStatisticsRequest` (@gauzy/ui-core/core) puts on the wire, so the
 * comparator can never be narrower than the payload it guards.
 *
 * @param context The ambient dashboard widget context.
 * @returns A deterministic key; the empty string for a missing context.
 */
export function timeTrackScopeKey(context: IDashboardWidgetContext | null): string {
	if (!context) {
		return '';
	}

	return [
		context.tenantId,
		context.organizationId,
		toEpoch(context.startDate),
		toEpoch(context.endDate),
		toEpoch(context.todayStart),
		toEpoch(context.todayEnd),
		context.timeZone,
		(context.employeeIds ?? []).join(','),
		(context.projectIds ?? []).join(','),
		(context.teamIds ?? []).join(',')
	].join('|');
}

/**
 * Epoch milliseconds of a value the context types as a `Date`.
 *
 * Defensive on purpose: a context restored from a bookmark carries an ISO
 * STRING, and calling `.getTime()` on it throws — inside a
 * `distinctUntilChanged` comparator that kills the widget's subscription for the
 * rest of the session. Mirrors the same guard in the core widget families.
 *
 * @param value The date to normalize.
 * @returns The epoch value, or an empty string when absent or unparsable.
 */
function toEpoch(value: Date | undefined): string {
	if (!value) {
		return '';
	}
	const time = value instanceof Date ? value.getTime() : new Date(value as unknown as string).getTime();
	return Number.isNaN(time) ? '' : String(time);
}

/**
 * Builds the range-aware translation key the legacy panels used for their
 * "nothing here" message (`..._DAY` / `..._WEEK` / `..._PERIOD`).
 *
 * The suffixes ARE the {@link RangePeriod} values, so a widget only has to
 * declare the shared prefix.
 *
 * @param baseKey Translation key without the range suffix, e.g. `TIMESHEET.NO_MANUAL_TIME`.
 * @param period The classified range.
 * @returns The full translation key.
 */
export function rangeMessageKey(baseKey: string, period: RangePeriod): string {
	return `${baseKey}_${period}`;
}

/** Days in a week — the fixed width of the Members panel's bar graph. */
const DAYS_IN_WEEK = 7;

/** One bar of the Members panel's weekly activity graph. */
export interface IWeekHourBar {
	/** Day index, 0 (Sunday) through 6. */
	day: number;
	/** Share of the member's week logged on that day, 0..100. */
	duration: number;
}

/**
 * Normalizes a member's `weekHours` into exactly seven bars of RELATIVE height.
 *
 * Replicates the underscore-based reshaping in `TimeTrackingComponent.getMembers()`
 * without pulling underscore into a lazily loaded widget chunk: the API returns
 * only the days that have logs, and each bar's height is that day's share of the
 * member's own week (so the tallest day of every member reaches the top).
 *
 * @param weekHours Raw per-day durations as returned by the API.
 * @returns Seven bars, ordered Sunday..Saturday, with `duration` as a percentage.
 */
export function toWeekHourBars(weekHours: Array<{ duration: number; day: number }> | undefined): IWeekHourBar[] {
	const byDay = new Map<number, number>();
	let total = 0;

	for (const entry of weekHours ?? []) {
		// `Number(...)` for BOTH the bucket and the total: the API may hand back a
		// duration as a string, and mixing coercions is what makes the shares miss
		// 100% (the same trap `withDurationPercentage` documents).
		const duration = Number(entry?.duration) || 0;
		byDay.set(entry?.day, (byDay.get(entry?.day) ?? 0) + duration);
		total += duration;
	}

	return Array.from({ length: DAYS_IN_WEEK }, (_, day: number) => ({
		day,
		duration: total > 0 ? ((byDay.get(day) ?? 0) * 100) / total : 0
	}));
}

/** Shown when an error carries no readable message of its own. */
const GENERIC_ERROR_MESSAGE = 'Something went wrong';

/**
 * Normalizes anything thrown by an HTTP call (or held in the base widget's
 * `error` signal) into a displayable message.
 *
 * An `HttpErrorResponse` nests the server's text under `error.message`, so that
 * is unwrapped too. A bare object is NEVER stringified: `String({})` renders the
 * useless `[object Object]` straight into the widget's error state.
 *
 * @param error The caught value.
 * @returns A human readable message, or `null` when there is no error.
 */
export function toErrorMessage(error: unknown): string | null {
	if (!error) {
		return null;
	}
	if (typeof error === 'string') {
		return error;
	}
	if (typeof error !== 'object') {
		return String(error);
	}

	const candidate = error as { message?: unknown; error?: { message?: unknown } };
	// The API payload's own message wins: it is the one written for a human.
	const nested = candidate.error?.message;
	if (typeof nested === 'string' && nested.length > 0) {
		return nested;
	}
	const message = candidate.message;
	return typeof message === 'string' && message.length > 0 ? message : GENERIC_ERROR_MESSAGE;
}
