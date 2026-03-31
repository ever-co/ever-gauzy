import { useState, useEffect, useCallback, useMemo } from 'react';
import { TimesheetStatisticsService } from '@gauzy/ui-core/core';
import { useInjector, useTypedEvent } from '@gauzy/ui-react';
import { DashboardRefreshedEvent } from '../dashboard-time-track-react-ui.events';
import { type DateRangeFilters } from './use-date-range-filters';

// Mirrors ICountsStatistics from @gauzy/contracts
export interface CountsStatistics {
	employeesCount: number;
	projectsCount: number;
	weekActivities: number;
	weekDuration: number;
	todayActivities: number;
	todayDuration: number;
}

/** Return type of useCountsStatistics. */
export interface UseCountsStatisticsResult {
	counts: CountsStatistics | null;
	/** Trigger a manual data refresh. */
	refresh: () => void;
}

/**
 * useCountsStatistics
 *
 * Fetches time tracking counts from TimesheetStatisticsService whenever
 * the provided `filters` change. Supports auto-refresh via `refreshInterval`
 * and exposes a manual `refresh` function.
 *
 * @param filters - Resolved date-range filters from `useDateRangeFilters()`.
 * @param refreshInterval - Auto-refresh interval in ms. 0 = disabled.
 */
export function useCountsStatistics(
	filters: DateRangeFilters | null,
	refreshInterval: number
): UseCountsStatisticsResult {
	const [counts, setCounts] = useState<CountsStatistics | null>(null);
	const injector = useInjector();
	const dashboardEvent = useTypedEvent(DashboardRefreshedEvent);

	const statsService = useMemo(
		() => injector?.get(TimesheetStatisticsService, null) as TimesheetStatisticsService | null,
		[injector]
	);

	const fetchCounts = useCallback(async () => {
		if (!statsService || !filters) return;

		try {
			const data = await statsService.getCounts(filters as any);
			const typedData = data as CountsStatistics;
			setCounts(typedData);

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
	}, [statsService, filters, dashboardEvent]);

	useEffect(() => {
		fetchCounts();

		if (refreshInterval > 0) {
			const interval = setInterval(fetchCounts, refreshInterval);
			return () => clearInterval(interval);
		}
	}, [fetchCounts, refreshInterval]);

	return { counts, refresh: fetchCounts };
}
