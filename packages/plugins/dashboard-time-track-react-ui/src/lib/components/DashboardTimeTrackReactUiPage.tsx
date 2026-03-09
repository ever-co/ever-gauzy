import { useState, useCallback } from 'react';
import { usePluginSettings } from '@gauzy/ui-react';
import { Card, CardHeader, CardContent, formatDuration } from '@gauzy/ui-react-components';
import { useDateRangeFilters, useCountsStatistics, type RangePeriod } from '../hooks';
import { DashboardHeader } from './DashboardHeader';
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

/** Period-based label mapping — mirrors Angular TimeTrackingComponent.titleMapper(). */
const WORKED_PERIOD_LABELS: Record<RangePeriod, string> = {
	DAY: 'Worked for day',
	WEEK: 'Worked this week',
	PERIOD: 'Worked over period'
};

const ACTIVITY_PERIOD_LABELS: Record<RangePeriod, string> = {
	DAY: 'Daily Activity',
	WEEK: 'Weekly Activity',
	PERIOD: 'Activity over period'
};

/**
 * DashboardTimeTrackReactUiPage
 *
 * React component rendered inside the "Dashboard Time Track" tab.
 * Renders a header with title/date range/refresh controls and 6 Time Tracking
 * stat cards, reacting to Angular date-range, organization, employee, project,
 * team, and timezone selections.
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
	const refreshIntervalSec = (settings.refreshInterval ?? 300) as number;

	// ── Auto-refresh state ──────────────────────────────────────
	const [autoRefresh, setAutoRefresh] = useState(true);
	const refreshInterval = autoRefresh ? refreshIntervalSec * 1000 : 0;

	// ── Angular filter state (date range, org, employee, project, team, tz) ──
	const filters = useDateRangeFilters();

	// ── Fetch statistics based on resolved filters ───────────────
	const { counts, refresh } = useCountsStatistics(filters, refreshInterval);

	// ── Manual refresh callback ─────────────────────────────────
	const handleRefresh = useCallback(() => {
		refresh();
	}, [refresh]);

	// ── Derived visibility & labels ─────────────────────────────
	const period = filters?.selectedPeriod ?? 'WEEK';
	const hasEmployee = filters?.hasEmployee ?? false;
	const hasProject = filters?.hasProject ?? false;

	return (
		<Card variant="accent">
			{/* Header */}
			<CardHeader>
				<DashboardHeader
					filters={filters}
					autoRefresh={autoRefresh}
					onAutoRefreshChange={setAutoRefresh}
					onRefresh={handleRefresh}
				/>
			</CardHeader>

			{/* Widgets */}
			<CardContent>
				<div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', width: '100%' }}>
					{showMembersWorked && !hasEmployee && (
						<MembersWorkedWidget count={counts?.employeesCount ?? 0} />
					)}
					{showProjectsWorked && !hasProject && (
						<ProjectsWorkedWidget count={counts?.projectsCount ?? 0} />
					)}
					{showTodayActivity && (
						<TodayActivityWidget percentage={counts?.todayActivities ?? 0} />
					)}
					{showWorkedToday && (
						<WorkedTodayWidget duration={formatDuration(counts?.todayDuration ?? 0)} />
					)}
					{showWorkedThisWeek && (
						<WorkedThisWeekWidget
							label={WORKED_PERIOD_LABELS[period]}
							duration={formatDuration(counts?.weekDuration ?? 0)}
							progressPercent={counts?.weekActivities ?? 0}
						/>
					)}
					{showWeeklyActivity && (
						<WeeklyActivityWidget
							label={ACTIVITY_PERIOD_LABELS[period]}
							percentage={counts?.weekActivities ?? 0}
						/>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
