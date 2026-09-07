/*
 * Public API Surface of @gauzy/plugin-dashboard-time-track-react-ui
 *
 * The React flavour of the Time Tracking dashboard, integrated into Angular
 * through @gauzy/plugin-ui + @gauzy/ui-react.
 */

// Plugin definition
export { DashboardTimeTrackReactUiPlugin } from './lib/dashboard-time-track-react-ui.plugin';

// Route (for hosts that want to mount the page elsewhere)
export { DASHBOARD_TIME_TRACK_PATH, DASHBOARD_TIME_TRACK_ROUTE } from './lib/dashboard-time-track-react-ui.routes';
export { DashboardTimeTrackReactUiPageComponent } from './lib/dashboard-time-track-react-ui-page.component';

// Type-safe event contracts (for cross-plugin consumption)
export {
	DashboardRefreshedEvent,
	WidgetVisibilityChangedEvent,
	type DashboardRefreshedPayload,
	type WidgetVisibilityPayload
} from './lib/dashboard-time-track-react-ui.events';

// React building blocks + hooks + pure helpers (reusable by other React dashboards)
export * from './lib/components';
export * from './lib/hooks';
export * from './lib/utils';
