import { PermissionsEnum } from '@gauzy/contracts';
import { defineDeclarativePlugin, IPluginI18nService, PluginRouteInput } from '@gauzy/plugin-ui';
import { REACT_TIME_TRACKING_DASHBOARD_ROUTE, REACT_TIME_TRACKING_PATH } from './react-ui.routes';
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
	// Plugin-specific translations (deep-merged into @ngx-translate at bootstrap).
	// Core keys like TIMESHEET.TIME_TRACKING remain untouched.
	// Add more languages: import fr from '../i18n/fr.json'; → { en, fr }
	// ─────────────────────────────────────────────────────────────
	translations: { en },
	// ─────────────────────────────────────────────────────────────
	// Register the React Time Tracking dashboard tab via page extension
	// ─────────────────────────────────────────────────────────────
	tabs: [
		{
			tabsetId: 'dashboard-page',
			tabId: 'react-time-tracking',
			tabsetType: 'route',
			path: `/pages/dashboard/${REACT_TIME_TRACKING_PATH}`,
			tabTitle: (_i18n: IPluginI18nService) => _i18n.getTranslation('DASHBOARD_PAGE.TABS.REACT_TIME_TRACKING'),
			tabIcon: 'code-outline',
			responsive: true,
			activeLinkOptions: { exact: false },
			order: 4,
			permissions: [PermissionsEnum.ADMIN_DASHBOARD_VIEW, PermissionsEnum.TIME_TRACKING_DASHBOARD]
		}
	]
});
