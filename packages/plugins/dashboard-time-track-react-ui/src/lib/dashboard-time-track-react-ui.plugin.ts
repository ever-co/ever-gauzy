import { PermissionsEnum } from '@gauzy/contracts';
import { defineDeclarativePlugin, IPluginI18nService, PluginRouteInput } from '@gauzy/plugin-ui';
import { DASHBOARD_TIME_TRACK_ROUTE, DASHBOARD_TIME_TRACK_PATH } from './dashboard-time-track-react-ui.routes';
import en from '../i18n/en.json';

/**
 * React UI Plugin Definition.
 *
 * Registers the Time Tracking stat widgets (Members worked, Projects worked,
 * Today's Activity, Worked today, Worked this week, Weekly Activity) as a
 * single React extension on the Time Tracking dashboard. Data is fetched live
 * from TimesheetStatisticsService via the Angular injector bridge.
 *
 * Uses `defineDeclarativePlugin` — no Angular NgModule or manual service
 * injection required. Routes and tabs are registered automatically at
 * bootstrap via the services provided to `PluginUiModule.init()`.
 *
 * ## Features Demonstrated
 *
 * - **Versioning**: `version: '1.0.0'` — enables compatibility checks
 * - **Namespace Isolation**: `translationNamespace: 'REACT_UI'` — prevents i18n key collisions
 * - **Settings**: Dashboard widget visibility toggles with auto-generated UI
 * - **Type-Safe Events**: `DashboardRefreshedEvent` / `WidgetVisibilityChangedEvent` in `dashboard-time-track-react-ui.events.ts`
 * - **Permissions**: Tab visibility gated by `ADMIN_DASHBOARD_VIEW` + `TIME_TRACKING_DASHBOARD`
 *
 * ## Usage
 *
 * Add to your plugin config:
 * ```typescript
 * import { DashboardTimeTrackReactUiPlugin } from '@gauzy/plugin-dashboard-time-track-react-ui';
 *
 * export const PLUGIN_UI_CONFIG: PluginUiConfig = {
 *   plugins: [DashboardTimeTrackReactUiPlugin]
 * };
 * ```
 */
export const DashboardTimeTrackReactUiPlugin = defineDeclarativePlugin('dashboard-time-track-react-ui', {
	// ── Versioning & Compatibility ────────────────────────────────
	version: '1.0.0',

	// ── Location ─────────────────────────────────────────────────
	location: 'page-sections',

	// ── Routes ───────────────────────────────────────────────────
	routes: [DASHBOARD_TIME_TRACK_ROUTE as PluginRouteInput],

	// ── Namespace-isolated translations ──────────────────────────
	// All keys are auto-wrapped under 'REACT_UI' to avoid collisions.
	// Use: instant('REACT_UI.DASHBOARD_PAGE.TABS.REACT_TIME_TRACKING')
	// or via NamespacedTranslateHelper: instant('DASHBOARD_PAGE.TABS.REACT_TIME_TRACKING')
	translationNamespace: 'REACT_UI',
	translations: { en },

	// ── Plugin Settings (auto-generated UI) ──────────────────────
	settings: {
		title: 'React Dashboard Widgets',
		description: 'Configure which widgets are visible on the React Time Tracking dashboard.',
		category: 'dashboard',
		fields: [
			{
				key: 'showMembersWorked',
				type: 'boolean',
				label: 'Show Members Worked',
				defaultValue: true,
				order: 1
			},
			{
				key: 'showProjectsWorked',
				type: 'boolean',
				label: 'Show Projects Worked',
				defaultValue: true,
				order: 2
			},
			{
				key: 'showTodayActivity',
				type: 'boolean',
				label: 'Show Today Activity',
				defaultValue: true,
				order: 3
			},
			{
				key: 'showWorkedToday',
				type: 'boolean',
				label: 'Show Worked Today',
				defaultValue: true,
				order: 4
			},
			{
				key: 'showWorkedThisWeek',
				type: 'boolean',
				label: 'Show Worked This Week',
				defaultValue: true,
				order: 5
			},
			{
				key: 'showWeeklyActivity',
				type: 'boolean',
				label: 'Show Weekly Activity',
				defaultValue: true,
				order: 6
			},
			{
				key: 'refreshInterval',
				type: 'number',
				label: 'Auto-refresh interval (seconds)',
				description: 'How often to refresh dashboard data. Set to 0 to disable.',
				defaultValue: 300,
				validation: { min: 0, max: 3600 },
				order: 7
			}
		]
	},

	// ── Dashboard Tab ────────────────────────────────────────────
	tabs: [
		{
			tabsetId: 'dashboard-page',
			tabId: 'react-time-tracking',
			tabsetType: 'route',
			path: `/pages/dashboard/${DASHBOARD_TIME_TRACK_PATH}`,
			tabTitle: (_i18n: IPluginI18nService) =>
				_i18n.getTranslation('REACT_UI.DASHBOARD_PAGE.TABS.REACT_TIME_TRACKING'),
			tabIcon: 'code-outline',
			responsive: true,
			activeLinkOptions: { exact: false },
			order: 4,
			permissions: [PermissionsEnum.ADMIN_DASHBOARD_VIEW, PermissionsEnum.TIME_TRACKING_DASHBOARD]
		}
	]
});
