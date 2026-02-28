/*
 * Public API Surface of @gauzy/plugin-react-ui
 *
 * This package integrates React components into Angular
 * using @gauzy/plugin-ui.
 */

// Plugin definitions
export { ReactUiPlugin } from './lib/react-ui.plugin';

// Type-safe event contracts (for cross-plugin consumption)
export {
	DashboardRefreshedEvent,
	WidgetVisibilityChangedEvent,
	type DashboardRefreshedPayload,
	type WidgetVisibilityPayload
} from './lib/react-ui.events';
