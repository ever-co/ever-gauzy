import { usePluginSettings } from '@gauzy/ui-react';
import { theme, formatDuration } from '@gauzy/ui-react-components';
import { useCountsStatistics } from '../hooks';
import {
	MembersWorkedWidget,
	ProjectsWorkedWidget,
	TodayActivityWidget,
	WorkedTodayWidget,
	WorkedThisWeekWidget,
	WeeklyActivityWidget
} from './widgets';

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
 * DashboardTimeTrackReactUiPage
 *
 * React component rendered inside the "Dashboard Time Track" tab.
 * Renders all 6 Time Tracking stat cards using data from `useCountsStatistics`.
 *
 * Features:
 * - **Settings-driven visibility**: Each widget can be toggled via plugin settings
 * - **Type-safe events**: Emits `DashboardRefreshedEvent` after each data refresh
 * - **Configurable refresh**: Auto-refresh interval is configurable via settings
 */
export function DashboardTimeTrackReactUiPage() {
	// ── Plugin Settings (reactive) ──────────────────────────────
	const settings = usePluginSettings('dashboard-time-track-react-ui') ?? DEFAULT_SETTINGS;
	const showMembersWorked = (settings.showMembersWorked ?? true) as boolean;
	const showProjectsWorked = (settings.showProjectsWorked ?? true) as boolean;
	const showTodayActivity = (settings.showTodayActivity ?? true) as boolean;
	const showWorkedToday = (settings.showWorkedToday ?? true) as boolean;
	const showWorkedThisWeek = (settings.showWorkedThisWeek ?? true) as boolean;
	const showWeeklyActivity = (settings.showWeeklyActivity ?? true) as boolean;
	const refreshInterval = ((settings.refreshInterval ?? 300) as number) * 1000;

	// ── Fetch statistics with auto-refresh ──────────────────────
	const counts = useCountsStatistics(refreshInterval);

	return (
		<div style={{ padding: '1rem', fontFamily: theme.font, background: 'transparent' }}>
			<div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', width: '100%' }}>
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
		</div>
	);
}
