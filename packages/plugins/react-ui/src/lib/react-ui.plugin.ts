import { PermissionsEnum } from '@gauzy/contracts';
import { defineDeclarativePlugin, PluginRouteInput } from '@gauzy/plugin-ui';
import { REACT_TIME_TRACKING_DASHBOARD_ROUTE, REACT_TIME_TRACKING_PATH } from './react-ui.routes';

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
 * ## Usage
 *
 * Add to your plugin config:
 * ```typescript
 * import { ReactUiPlugin } from '@gauzy/plugin-react-ui';
 *
 * export const PLUGIN_UI_CONFIG: PluginUiConfig = {
 *   plugins: [ReactUiPlugin]
 * };
 * ```
 */
export const ReactUiPlugin = defineDeclarativePlugin('react-ui', {
	location: 'page-sections',
	routes: [REACT_TIME_TRACKING_DASHBOARD_ROUTE as PluginRouteInput],
	// ─────────────────────────────────────────────────────────────
	// Register the React Time Tracking dashboard tab via page extension
	// ─────────────────────────────────────────────────────────────
	tabs: [
		{
			tabsetId: 'dashboard-page',
			tabId: 'react-time-tracking',
			tabsetType: 'route',
			path: `/pages/dashboard/${REACT_TIME_TRACKING_PATH}`,
			tabTitle: (_i18n: any) => _i18n.getTranslation('TIMESHEET.TIME_TRACKING'),
			tabIcon: 'code-outline',
			responsive: true,
			activeLinkOptions: { exact: false },
			order: 4,
			permissions: [PermissionsEnum.ADMIN_DASHBOARD_VIEW, PermissionsEnum.TIME_TRACKING_DASHBOARD]
		}
	]
});
