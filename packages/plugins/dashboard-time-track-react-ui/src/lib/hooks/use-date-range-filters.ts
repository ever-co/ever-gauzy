import { useMemo } from 'react';
import { combineLatest, of } from 'rxjs';
import { debounceTime, filter, map } from 'rxjs/operators';
import { IDateRangePicker, IOrganization, ISelectedEmployee } from '@gauzy/contracts';
import { toUtcOffset } from '@gauzy/ui-core/common';
import { DateRangePickerBuilderService, Store } from '@gauzy/ui-core/core';
import { getAdjustDateRangeFutureAllowed, TimeZoneService } from '@gauzy/ui-core/shared';
import { useInjector, useObservable } from '@gauzy/ui-react';
import moment from 'moment-timezone';

/** The period type derived from the selected date range. */
export type RangePeriod = 'DAY' | 'WEEK' | 'PERIOD';

/** Resolved filter state from Angular selectors. */
export interface DateRangeFilters {
	/** API-ready payload fields. */
	tenantId: string;
	organizationId: string;
	todayStart: string;
	todayEnd: string;
	startDate: string;
	endDate: string;
	timeZone: string;
	employeeIds?: string[];
	projectIds?: string[];
	teamIds?: string[];

	/** Convenience flags for widget visibility. */
	hasEmployee: boolean;
	hasProject: boolean;

	/** Period type derived from the date range span. */
	selectedPeriod: RangePeriod;

	/** Header context for display. */
	employeeName: string | null;
	organizationName: string;
	displayStartDate: Date;
	displayEndDate: Date;
}

/**
 * Determines the period type from a date range.
 */
function detectPeriod(startDate: Date, endDate: Date): RangePeriod {
	const diffDays = moment(endDate).diff(moment(startDate), 'days');
	if (diffDays === 0) return 'DAY';
	if (diffDays <= 6) return 'WEEK';
	return 'PERIOD';
}

/**
 * useDateRangeFilters
 *
 * Subscribes to Angular's DateRangePickerBuilderService, Store (org/employee/project/team),
 * and TimeZoneService. Returns a reactive `DateRangeFilters` object that updates whenever
 * any selector changes — mirroring the Angular `TimeTrackingComponent.preparePayloads()` flow.
 *
 * @returns Current filters or null if not yet resolved.
 */
export function useDateRangeFilters(): DateRangeFilters | null {
	const injector = useInjector();

	const store = useMemo(() => injector?.get(Store, null) as Store | null, [injector]);
	const dateRangeService = useMemo(
		() => injector?.get(DateRangePickerBuilderService, null) as DateRangePickerBuilderService | null,
		[injector]
	);
	const timeZoneService = useMemo(
		() => injector?.get(TimeZoneService, null) as TimeZoneService | null,
		[injector]
	);

	const filters$ = useMemo(() => {
		if (!store || !dateRangeService || !timeZoneService) return of(null);

		return combineLatest([
			store.selectedOrganization$,
			dateRangeService.selectedDateRange$,
			store.selectedEmployee$,
			store.selectedProject$,
			store.selectedTeam$,
			timeZoneService.timeZone$
		]).pipe(
			debounceTime(300),
			filter(([org, dateRange]: [IOrganization, IDateRangePicker, ...unknown[]]) => !!org && !!dateRange),
			map(([organization, dateRange, employee, project, team, timeZone]) => {
				const org = organization as IOrganization;
				const dr = dateRange as IDateRangePicker;
				const tz = timeZone as string;
				const { startDate, endDate } = getAdjustDateRangeFutureAllowed(dr);

				const emp = employee as ISelectedEmployee;
				const proj = project as { id?: string };
				const tm = team as { id?: string };

				const result: DateRangeFilters = {
					tenantId: org.tenantId,
					organizationId: org.id,
					todayStart: toUtcOffset(moment().startOf('day'), tz).format('YYYY-MM-DD HH:mm:ss'),
					todayEnd: toUtcOffset(moment().endOf('day'), tz).format('YYYY-MM-DD HH:mm:ss'),
					startDate: toUtcOffset(startDate, tz).format('YYYY-MM-DD HH:mm:ss'),
					endDate: toUtcOffset(endDate, tz).format('YYYY-MM-DD HH:mm:ss'),
					timeZone: tz,
					hasEmployee: !!emp?.id,
					hasProject: !!proj?.id,
					selectedPeriod: detectPeriod(startDate, endDate),

					// Header context
					employeeName: emp?.id ? (emp.fullName ?? null) : null,
					organizationName: org.name,
					displayStartDate: dr.startDate as Date,
					displayEndDate: dr.endDate as Date
				};

				if (emp?.id) result.employeeIds = [emp.id];
				if (proj?.id) result.projectIds = [proj.id];
				if (tm?.id) result.teamIds = [tm.id];

				return result;
			})
		);
	}, [store, dateRangeService, timeZoneService]);

	return useObservable(filters$) ?? null;
}
