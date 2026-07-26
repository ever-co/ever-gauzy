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
