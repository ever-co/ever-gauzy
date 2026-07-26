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

	const startWork = moment(context.organization?.defaultStartTime, 'HH:mm');
	const endWork = moment(context.organization?.defaultEndTime, 'HH:mm');
	const workingSeconds = endWork.diff(startWork) / 1000;

	const dayCount = moment(context.endDate).diff(moment(context.startDate), 'days') + 1;

	return dayCount * (isNaN(workingSeconds) ? SECONDS_IN_DAY : workingSeconds) * (employeesCount || 0);
}

/**
 * Normalizes anything thrown by an HTTP call (or held in the base widget's
 * `error` signal) into a displayable message.
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
	const message = (error as { message?: unknown }).message;
	return typeof message === 'string' && message.length > 0 ? message : String(error);
}
