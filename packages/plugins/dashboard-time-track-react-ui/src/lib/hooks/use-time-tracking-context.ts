import { useEffect, useMemo, useState } from 'react';
import { combineLatest } from 'rxjs';
import { debounceTime, filter, map } from 'rxjs/operators';
import { IDateRangePicker, IOrganization, ISelectedEmployee, IUser } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { DateRangePickerBuilderService, Store } from '@gauzy/ui-core/core';
import { TimeZoneService } from '@gauzy/ui-core/shared';
import { useInjector, useObservable } from '@gauzy/ui-react';
import {
	buildStatisticsPayload,
	isCurrentWeek,
	RangePeriod,
	resolveRangePeriod,
	type StatisticsPayload,
	type TimeTrackingContext
} from '../utils';

/** Everything the dashboard derives from the Angular selectors, in one immutable snapshot. */
export interface TimeTrackingSelection extends TimeTrackingContext {
	/** The request all statistics endpoints receive (Angular `payloads$`). */
	payload: StatisticsPayload;
	/** Stable key of `payload` — a change means "refetch" (Angular `distinctUntilChange()`). */
	payloadKey: string;
	/** DAY / WEEK / PERIOD, detected exactly like Angular. */
	selectedPeriod: RangePeriod | undefined;
	/** Whether the range is the current calendar week (drives the "Worked this week" title). */
	currentWeek: boolean;
	/** True when an employee is selected (hides "Members worked" + the Members window). */
	hasEmployee: boolean;
	/** True when a project is selected (hides "Projects worked"). */
	hasProject: boolean;
}

/**
 * Subscribes to the SAME six Angular streams the `TimeTrackingComponent` combines
 * (`selectedOrganization$`, `selectedDateRange$`, `selectedEmployee$`, `selectedProject$`,
 * `selectedTeam$`, `timeZone$`) with the same `distinctUntilChange()` + `debounceTime(500)`
 * and the same "wait for org, range and employee" gates, and turns each emission into a
 * {@link TimeTrackingSelection} carrying the ready-to-send payload.
 *
 * @returns The current selection, or `null` until the Angular selectors have all emitted.
 */
export function useTimeTrackingContext(): TimeTrackingSelection | null {
	const injector = useInjector();
	const store = useMemo(() => injector.get(Store), [injector]);
	const dateRangeService = useMemo(() => injector.get(DateRangePickerBuilderService), [injector]);
	const timeZoneService = useMemo(() => injector.get(TimeZoneService), [injector]);

	const selection$ = useMemo(
		() =>
			combineLatest([
				store.selectedOrganization$,
				dateRangeService.selectedDateRange$,
				store.selectedEmployee$,
				store.selectedProject$,
				store.selectedTeam$,
				timeZoneService.timeZone$.pipe(filter((timeZone: string) => !!timeZone))
			]).pipe(
				distinctUntilChange(),
				debounceTime(500),
				filter(([organization, dateRange, employee]) => !!organization && !!dateRange && !!employee),
				map(([organization, dateRange, employee, project, team, timeZone]) => {
					const org = organization as IOrganization;
					const range = dateRange as IDateRangePicker;
					const selectedEmployee = employee as ISelectedEmployee;
					const selectedProject = project as { id?: string } | null;
					const selectedTeam = team as { id?: string } | null;
					const context: TimeTrackingContext = {
						organization: org,
						dateRange: range,
						employeeIds: selectedEmployee?.id ? [selectedEmployee.id] : [],
						projectIds: selectedProject?.id ? [selectedProject.id] : [],
						teamIds: selectedTeam?.id ? [selectedTeam.id] : [],
						// Angular reads `currentTimeZone` while building the payload; the stream value is the same.
						timeZone: (timeZone as string) || timeZoneService.currentTimeZone
					};
					const payload = buildStatisticsPayload(context);
					const selection: TimeTrackingSelection = {
						...context,
						payload,
						payloadKey: JSON.stringify(payload),
						selectedPeriod: resolveRangePeriod(range),
						currentWeek: isCurrentWeek(range),
						hasEmployee: context.employeeIds.length > 0,
						hasProject: context.projectIds.length > 0
					};
					return selection;
				})
			),
		[store, dateRangeService, timeZoneService]
	);

	return useObservable(selection$) ?? null;
}

/**
 * The signed-in user (Angular `store.user$`), or `null`.
 */
export function useCurrentUser(): IUser | null {
	const injector = useInjector();
	const store = useMemo(() => injector.get(Store), [injector]);
	const user$ = useMemo(() => store.user$, [store]);
	const [user, setUser] = useState<IUser | null>(() => store.user ?? null);
	useEffect(() => {
		const subscription = user$.subscribe((value: IUser) => setUser(value ?? null));
		return () => subscription.unsubscribe();
	}, [user$]);
	return user;
}
