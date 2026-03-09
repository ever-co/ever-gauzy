/*
 * Public API Surface of @gauzy/plugin-dashboard-time-track-react-ui
 *
 * This package integrates React components into Angular
 * using @gauzy/plugin-ui.
 */

// Plugin definitions
export { DashboardTimeTrackReactUiPlugin } from './lib/dashboard-time-track-react-ui.plugin';

// Type-safe event contracts (for cross-plugin consumption)
export {
	DashboardRefreshedEvent,
	WidgetVisibilityChangedEvent,
	type DashboardRefreshedPayload,
	type WidgetVisibilityPayload
} from './lib/dashboard-time-track-react-ui.events';
