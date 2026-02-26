import { useState, useEffect } from 'react';
import { useInjector } from '@gauzy/ui-react-bridge';
import { TimesheetStatisticsService, Store } from '@gauzy/ui-core/core';
import { theme } from './theme';
import { formatDuration, currentWeekRange, todayRange } from './helpers';
import {
	MembersWorkedWidget,
	ProjectsWorkedWidget,
	TodayActivityWidget,
	WorkedTodayWidget,
	WorkedThisWeekWidget,
	WeeklyActivityWidget
} from './widgets';

// Mirrors ICountsStatistics from @gauzy/contracts
interface CountsStatistics {
	employeesCount: number;
	projectsCount: number;
	weekActivities: number;
	weekDuration: number;
	todayActivities: number;
	todayDuration: number;
}

/**
 * TimeTrackingDashboardWidgets
 *
 * Renders all 6 Time Tracking stat cards and fetches live data from
 * TimesheetStatisticsService via the Angular injector bridge.
 * Auto-refreshes every 5 minutes.
 */
export function TimeTrackingDashboardWidgets() {
	const [counts, setCounts] = useState<CountsStatistics | null>(null);
	const injector = useInjector();

	useEffect(() => {
		if (!injector) return;

		let cancelled = false;

		const fetchCounts = async () => {
			try {
				const statsService = injector.get(
					TimesheetStatisticsService,
					null
				) as TimesheetStatisticsService | null;
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

				if (!cancelled) setCounts(data as CountsStatistics);
			} catch (err) {
				console.error('[TimeTrackingDashboardWidgets] Failed to fetch counts:', err);
			}
		};

		fetchCounts();

		// Auto-refresh every 5 minutes (matching Angular dashboard behavior)
		const interval = setInterval(fetchCounts, 5 * 60 * 1000);

		return () => {
			cancelled = true;
			clearInterval(interval);
		};
	}, [injector]);

	return (
		<div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', width: '100%', fontFamily: theme.font }}>
			<MembersWorkedWidget count={counts?.employeesCount ?? 0} />
			<ProjectsWorkedWidget count={counts?.projectsCount ?? 0} />
			<TodayActivityWidget percentage={counts?.todayActivities ?? 0} />
			<WorkedTodayWidget duration={formatDuration(counts?.todayDuration ?? 0)} />
			<WorkedThisWeekWidget
				duration={formatDuration(counts?.weekDuration ?? 0)}
				progressPercent={counts?.weekActivities ?? 0}
			/>
			<WeeklyActivityWidget percentage={counts?.weekActivities ?? 0} />
		</div>
	);
}
