import { useState, useEffect, useCallback } from 'react';
import { useInjector, usePluginSettings, useTypedEvent } from '@gauzy/plugin-ui-react';
import { TimesheetStatisticsService, Store } from '@gauzy/ui-core/core';
import { theme } from './theme';
import { formatDuration, currentWeekRange, todayRange } from './helpers';
import { DashboardRefreshedEvent } from '../react-ui.events';
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

/** Default settings values (match the plugin definition defaults). */
const DEFAULT_SETTINGS: Record<string, unknown> = {
	showMembersWorked: true,
	showProjectsWorked: true,
	showTodayActivity: true,
	showWorkedToday: true,
	showWorkedThisWeek: true,
	showWeeklyActivity: true,
	refreshInterval: 300
};

/**
 * TimeTrackingDashboardWidgets
 *
 * Renders all 6 Time Tracking stat cards and fetches live data from
 * TimesheetStatisticsService via the Angular injector bridge.
 *
 * Features:
 * - **Settings-driven visibility**: Each widget can be toggled via plugin settings
 * - **Type-safe events**: Emits `DashboardRefreshedEvent` after each data refresh
 * - **Configurable refresh**: Auto-refresh interval is configurable via settings
 */
export function TimeTrackingDashboardWidgets() {
	const [counts, setCounts] = useState<CountsStatistics | null>(null);
	const injector = useInjector();

	// ── Plugin Settings (reactive) ──────────────────────────────
	const settings = usePluginSettings('react-ui') ?? DEFAULT_SETTINGS;
	const showMembersWorked = (settings.showMembersWorked ?? true) as boolean;
	const showProjectsWorked = (settings.showProjectsWorked ?? true) as boolean;
	const showTodayActivity = (settings.showTodayActivity ?? true) as boolean;
	const showWorkedToday = (settings.showWorkedToday ?? true) as boolean;
	const showWorkedThisWeek = (settings.showWorkedThisWeek ?? true) as boolean;
	const showWeeklyActivity = (settings.showWeeklyActivity ?? true) as boolean;
	const refreshInterval = ((settings.refreshInterval ?? 300) as number) * 1000;

	// ── Type-Safe Event Handle ──────────────────────────────────
	const dashboardEvent = useTypedEvent(DashboardRefreshedEvent);

	const fetchCounts = useCallback(async () => {
		if (!injector) return;

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
			console.error('[TimeTrackingDashboardWidgets] Failed to fetch counts:', err);
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

	return (
		<div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', width: '100%', fontFamily: theme.font }}>
			{showMembersWorked && <MembersWorkedWidget count={counts?.employeesCount ?? 0} />}
			{showProjectsWorked && <ProjectsWorkedWidget count={counts?.projectsCount ?? 0} />}
			{showTodayActivity && <TodayActivityWidget percentage={counts?.todayActivities ?? 0} />}
			{showWorkedToday && <WorkedTodayWidget duration={formatDuration(counts?.todayDuration ?? 0)} />}
			{showWorkedThisWeek && (
				<WorkedThisWeekWidget
					duration={formatDuration(counts?.weekDuration ?? 0)}
					progressPercent={counts?.weekActivities ?? 0}
				/>
			)}
			{showWeeklyActivity && <WeeklyActivityWidget percentage={counts?.weekActivities ?? 0} />}
		</div>
	);
}
