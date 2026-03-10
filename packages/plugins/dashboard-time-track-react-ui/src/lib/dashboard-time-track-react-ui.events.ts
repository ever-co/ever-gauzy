import { definePluginEvent } from '@gauzy/plugin-ui';

// ─── Type-Safe Event Contracts ──────────────────────────────────────────────

/**
 * Payload emitted when the dashboard data is refreshed.
 */
export interface DashboardRefreshedPayload {
	employeesCount: number;
	projectsCount: number;
	todayDuration: number;
	weekDuration: number;
	refreshedAt: number;
}

/**
 * Emitted when the React Time Tracking dashboard data is refreshed.
 * Other plugins can listen to this event to react to data changes.
 *
 * @example
 * ```ts
 * // Subscribe from another plugin:
 * const handle = bindEventToBus(DashboardRefreshedEvent, eventBus);
 * handle.on().subscribe(event => {
 *   console.log('Dashboard refreshed:', event.payload.employeesCount);
 * });
 * ```
 */
export const DashboardRefreshedEvent = definePluginEvent<DashboardRefreshedPayload>(
	'dashboard-time-track-react-ui',
	'dashboard-time-track-react-ui:dashboard-refreshed',
	'Emitted when the React Time Tracking dashboard data is refreshed.'
);

/**
 * Payload for widget visibility toggle events.
 */
export interface WidgetVisibilityPayload {
	widgetId: string;
	visible: boolean;
}

/**
 * Emitted when a widget's visibility is toggled via settings.
 */
export const WidgetVisibilityChangedEvent = definePluginEvent<WidgetVisibilityPayload>(
	'dashboard-time-track-react-ui',
	'dashboard-time-track-react-ui:widget-visibility-changed',
	'Emitted when a dashboard widget is shown or hidden.'
);
