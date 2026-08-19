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
		startDate && endDate ? `${moment(startDate).format('dddd, LL')} - ${moment(endDate).format('dddd, LL')}` : '';

	return (
		<>
			{/* Top row: title + controls */}
			<div
				style={{
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'flex-start',
					flexWrap: 'wrap',
					gap: '0.75rem'
				}}
			>
				<div>
					{/*
					 * The page title. Same step as `gauzy-page-title-*`, which is what
					 * `ngx-header-title` resolves on every Angular tab, so a tab
					 * switch does not change the size of the heading.
					 */}
					<h4 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: theme.textPrimary }}>
						{title}
					</h4>
					{dateRangeText && (
						<span
							style={{
								fontSize: '0.75rem',
								color: theme.textSecondary,
								marginTop: '0.25rem',
								display: 'block'
							}}
						>
							{dateRangeText}
						</span>
					)}
				</div>

				{/* Controls */}
				<div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
					{/* Auto Refresh toggle */}
					{/*
					 * Auto-refresh. The label used to turn blue when the box was
					 * ticked, which made a checked control read like a link; the box
					 * itself already carries that state. The accent is the theme's
					 * own, so it matches the toggle on the Angular tab rather than
					 * the browser's default blue.
					 */}
					<label
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: '0.375rem',
							fontSize: '0.8125rem',
							color: theme.textSecondary,
							cursor: 'pointer',
							userSelect: 'none'
						}}
					>
						<input
							type="checkbox"
							checked={autoRefresh}
							onChange={(e) => onAutoRefreshChange(e.target.checked)}
							style={{ accentColor: theme.accent, width: 14, height: 14, cursor: 'pointer' }}
						/>
						Auto Refresh
					</label>

					{/* Refresh button */}
					{/*
					 * The manual refresh. Sized and edged like the app's own small
					 * outline buttons, and it says it is unavailable while
					 * auto-refresh is on instead of looking identical either way.
					 */}
					<button
						type="button"
						disabled={autoRefresh}
						onClick={onRefresh}
						style={{
							display: 'inline-flex',
							alignItems: 'center',
							gap: '0.375rem',
							padding: '0.3125rem 0.625rem',
							fontSize: '0.8125rem',
							fontWeight: 500,
							lineHeight: '1rem',
							border: `1px solid ${theme.border}`,
							borderRadius: theme.radiusSm,
							background: 'transparent',
							color: autoRefresh ? theme.textSecondary : theme.textPrimary,
							opacity: autoRefresh ? 0.6 : 1,
							cursor: autoRefresh ? 'default' : 'pointer',
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
