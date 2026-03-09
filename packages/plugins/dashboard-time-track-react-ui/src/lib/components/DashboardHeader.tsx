import { theme } from '@gauzy/ui-react-components';
import { type RangePeriod, type DateRangeFilters } from '../hooks';
import moment from 'moment';

/** Period-based header title prefix. */
const HEADER_TITLES: Record<RangePeriod, string> = {
	DAY: 'Daily',
	WEEK: 'Weekly',
	PERIOD: 'Monthly'
};

export interface DashboardHeaderProps {
	filters: DateRangeFilters | null;
	/** Whether auto-refresh is enabled. */
	autoRefresh: boolean;
	/** Callback to toggle auto-refresh. */
	onAutoRefreshChange: (value: boolean) => void;
	/** Callback to trigger a manual refresh. */
	onRefresh: () => void;
}

/**
 * DashboardHeader
 *
 * Renders the dashboard header with:
 * - Dynamic title (Daily/Weekly/Monthly Time Tracking for [Employee] from [Org])
 * - Date range subtitle
 * - Auto-refresh toggle and manual refresh button
 */
export function DashboardHeader({ filters, autoRefresh, onAutoRefreshChange, onRefresh }: DashboardHeaderProps) {
	const period = filters?.selectedPeriod ?? 'WEEK';
	const periodTitle = HEADER_TITLES[period];
	const orgName = filters?.organizationName ?? '';
	const employeeName = filters?.employeeName;
	const startDate = filters?.displayStartDate;
	const endDate = filters?.displayEndDate;

	// Build title: "Weekly Time Tracking for [Employee] from [Org]"
	const titleParts = [`${periodTitle} Time Tracking`];
	if (employeeName) {
		titleParts.push(`for ${employeeName}`);
	}
	if (orgName) {
		titleParts.push(`${employeeName ? 'from' : 'for'} ${orgName}`);
	}
	const title = titleParts.join(' ');

	// Format date range
	const dateRangeText =
		startDate && endDate
			? `${moment(startDate).format('dddd, LL')} - ${moment(endDate).format('dddd, LL')}`
			: '';

	return (
		<>
			{/* Top row: title + controls */}
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
				<div>
					<h4 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: theme.textPrimary }}>
						{title}
					</h4>
					{dateRangeText && (
						<span style={{ fontSize: '0.8125rem', color: theme.textHint, marginTop: '0.25rem', display: 'block' }}>
							{dateRangeText}
						</span>
					)}
				</div>

				{/* Controls */}
				<div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
					{/* Auto Refresh toggle */}
					<label
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: '0.375rem',
							fontSize: '0.8125rem',
							color: autoRefresh ? theme.blue : theme.textHint,
							cursor: 'pointer',
							userSelect: 'none'
						}}
					>
						<input
							type="checkbox"
							checked={autoRefresh}
							onChange={(e) => onAutoRefreshChange(e.target.checked)}
							style={{ accentColor: theme.blue, width: 16, height: 16, cursor: 'pointer' }}
						/>
						Auto Refresh
					</label>

					{/* Refresh button */}
					<button
						type="button"
						disabled={autoRefresh}
						onClick={onRefresh}
						style={{
							display: 'inline-flex',
							alignItems: 'center',
							gap: '0.375rem',
							padding: '0.375rem 0.75rem',
							fontSize: '0.8125rem',
							border: `1px solid ${theme.border}`,
							borderRadius: '0.25rem',
							background: 'transparent',
							color: autoRefresh ? theme.textHint : theme.textPrimary,
							cursor: autoRefresh ? 'not-allowed' : 'pointer',
							opacity: autoRefresh ? 0.6 : 1,
							fontFamily: theme.font
						}}
					>
						&#8635; Refresh
					</button>
				</div>
			</div>
		</>
	);
}
