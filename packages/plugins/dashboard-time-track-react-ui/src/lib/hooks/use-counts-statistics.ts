import { useState, useEffect, useCallback } from 'react';
import { TimesheetStatisticsService, Store } from '@gauzy/ui-core/core';
import { useInjector, useTypedEvent } from '@gauzy/ui-react';
import { currentWeekRange, todayRange } from '@gauzy/ui-react-components';
import { DashboardRefreshedEvent } from '../dashboard-time-track-react-ui.events';

// Mirrors ICountsStatistics from @gauzy/contracts
export interface CountsStatistics {
	employeesCount: number;
	projectsCount: number;
	weekActivities: number;
	weekDuration: number;
	todayActivities: number;
	todayDuration: number;
}

/**
 * useCountsStatistics
 *
 * Custom hook that fetches time tracking statistics from TimesheetStatisticsService
 * via the Angular injector bridge. Supports auto-refresh and emits a type-safe
 * `DashboardRefreshedEvent` after each successful fetch.
 *
 * @param refreshInterval - Auto-refresh interval in milliseconds. Set to 0 to disable.
 * @returns The latest counts statistics, or null if not yet loaded.
 */
export function useCountsStatistics(refreshInterval: number): CountsStatistics | null {
	const [counts, setCounts] = useState<CountsStatistics | null>(null);
	const injector = useInjector();
	const dashboardEvent = useTypedEvent(DashboardRefreshedEvent);

	const fetchCounts = useCallback(async () => {
		if (!injector) return;

		try {
			const statsService = injector.get(TimesheetStatisticsService, null) as TimesheetStatisticsService | null;
			const store = injector.get(Store, null) as Store | null;

			if (!statsService || !store) return;

			const organizationId = store.organizationId;
			const tenantId = store.tenantId;
			if (!organizationId || !tenantId) return;

			const { startDate, endDate } = currentWeekRange();
			const { todayStart, todayEnd } = todayRange();

			const data = await statsService.getCounts({
				organizationId,
				tenantId,
				startDate,
				endDate,
				todayStart,
				todayEnd
			} as any);

			const typedData = data as CountsStatistics;
			setCounts(typedData);

			// Emit type-safe event on successful refresh
			dashboardEvent.emit({
				employeesCount: typedData.employeesCount,
				projectsCount: typedData.projectsCount,
				todayDuration: typedData.todayDuration,
				weekDuration: typedData.weekDuration,
				refreshedAt: Date.now()
			});
		} catch (err) {
			console.error('[useCountsStatistics] Failed to fetch counts:', err);
		}
	}, [injector, dashboardEvent]);

	useEffect(() => {
		fetchCounts();

		// Auto-refresh at configurable interval (0 = disabled)
		if (refreshInterval > 0) {
			const interval = setInterval(fetchCounts, refreshInterval);
			return () => clearInterval(interval);
		}
	}, [fetchCounts, refreshInterval]);

	return counts;
}
