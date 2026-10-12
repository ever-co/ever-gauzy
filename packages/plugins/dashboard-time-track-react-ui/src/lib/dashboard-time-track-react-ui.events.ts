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
 * Emitted every time the React Time Tracking dashboard (re)loads its counters — on selection
 * changes, manual Refresh, the 5-minute auto-refresh and when a hidden widget is re-shown.
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
	/** `widget:<position>` (0–5, counter widgets) or `window:<position>` (0–5, windows). */
	widgetId: string;
	visible: boolean;
}

/**
 * Emitted when a widget's or window's visibility is toggled from the "Manage widgets" popover.
 */
export const WidgetVisibilityChangedEvent = definePluginEvent<WidgetVisibilityPayload>(
	'dashboard-time-track-react-ui',
	'dashboard-time-track-react-ui:widget-visibility-changed',
	'Emitted when a dashboard widget or window is shown or hidden.'
);
