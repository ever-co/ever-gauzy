import { PluginRouteInput, PluginUiDefinition } from '@gauzy/plugin-ui';
import { ReactUiModule } from './react-ui.module';
import { REACT_TIME_TRACKING_DASHBOARD_ROUTE } from './react-ui.routes';

/**
 * React UI Plugin Definition.
 *
 * Registers the Time Tracking stat widgets (Members worked, Projects worked,
 * Today's Activity, Worked today, Worked this week, Weekly Activity) as a
 * single React extension on the Time Tracking dashboard. Data is fetched live
 * from TimesheetStatisticsService via the Angular injector bridge.
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
export const ReactUiPlugin: PluginUiDefinition = {
	id: 'react-ui',
	location: 'page-sections',
	module: ReactUiModule,

	// ─────────────────────────────────────────────────────────────
	// Routes
	// ─────────────────────────────────────────────────────────────
	routes: [REACT_TIME_TRACKING_DASHBOARD_ROUTE as PluginRouteInput],

	// ─────────────────────────────────────────────────────────────
	// Extensions: Time Tracking Dashboard Widgets
	// ─────────────────────────────────────────────────────────────
	extensions: []
};
