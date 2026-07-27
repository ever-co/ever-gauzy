import * as moment from 'moment';
// Type-only import: this module must stay free of cross-package runtime
// dependencies so it can be unit tested without an Angular TestBed.
import type { IDashboardWidgetContext } from '@gauzy/ui-core/core';

/** Seconds in a full day, used when the organization has no working hours configured. */
const SECONDS_IN_DAY = 86400;

/**
 * Working seconds in one day for the context's organization.
 *
 * Replicates `TeamComponent._period`, with one correction: `moment(undefined,
 * 'HH:mm')` yields the CURRENT time instead of an invalid date, so an
 * organization without configured hours would produce a near-zero capacity
 * rather than reaching the documented full-day fallback.
 *
 * @param context - The ambient dashboard widget context.
 * @returns Seconds of capacity per day; a full day when it cannot be derived.
 */
export function resolveWorkingSeconds(context: IDashboardWidgetContext | null): number {
	const { defaultStartTime, defaultEndTime } = context?.organization ?? {};
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
 * Stable fingerprint of everything the Teams snapshot actually depends on.
 *
 * Used both as the cache key of {@link TeamsDashboardStatisticsService} and as
 * the `distinctUntilChanged` comparator of the widgets, so a context change that
 * cannot affect the numbers (currency, time format, a new `organization` object
 * identity after an unrelated store write) does NOT trigger a refetch.
 *
 * @param context - The ambient dashboard widget context.
 * @returns A deterministic key.
 */
export function teamsScopeKey(context: IDashboardWidgetContext | null): string {
	if (!context) {
		return '';
	}

	return [
		context.tenantId,
		context.organizationId,
		context.startDate?.getTime(),
		context.endDate?.getTime(),
		context.todayStart?.getTime(),
		context.todayEnd?.getTime(),
		context.timeZone,
		// Part of the key because it is the denominator of every member progress bar.
		context.organization?.defaultStartTime,
		context.organization?.defaultEndTime,
		(context.employeeIds ?? []).join(','),
		(context.projectIds ?? []).join(','),
		(context.teamIds ?? []).join(',')
	].join('|');
}

/**
 * De-duplicates a list of entities by their `id`.
 *
 * The Teams dashboard counts members and projects ACROSS teams, where the same
 * employee or project legitimately appears more than once.
 *
 * @param items - The entities to filter.
 * @returns A new array holding the first occurrence of every id.
 */
export function uniqueById<T extends { id?: unknown }>(items: T[]): T[] {
	const seen = new Set<unknown>();
	const unique: T[] = [];

	for (const item of items ?? []) {
		// An entity without an id cannot be de-duplicated; keep it rather than
		// collapsing every such row into a single one.
		if (item?.id === undefined || item?.id === null) {
			unique.push(item);
			continue;
		}
		if (seen.has(item.id)) {
			continue;
		}
		seen.add(item.id);
		unique.push(item);
	}

	return unique;
}

/**
 * Percentage of `value` within `total`, clamped to a renderable 0..100 range.
 *
 * @param value - The achieved amount.
 * @param total - The capacity. `0` (or a missing value) yields `0`.
 * @returns A percentage between 0 and 100.
 */
export function toPercentage(value: number, total: number): number {
	if (!total || !Number.isFinite(total) || !Number.isFinite(value)) {
		return 0;
	}
	const percentage = Math.abs((value / total) * 100);
	return Number.isFinite(percentage) ? Math.min(percentage, 100) : 0;
}
