import { customDashboardGuard, PageRouteRegistryConfig, standardDashboardGuard } from '@gauzy/ui-core/core';

/** Path segment for the Time Tracking tab under /pages/dashboard. */
export const DASHBOARD_TIME_TRACKING_PATH = 'time-tracking';

/** Path segment for the custom dashboards host under /pages/dashboard. */
export const DASHBOARD_CUSTOM_PATH = 'custom/:id';

/**
 * Route config for registering the Angular Time Tracking tab at dashboard-sections.
 * Picked up by createDashboardRoutes via getPageLocationRoutes('dashboard-sections').
 *
 * `standardDashboardGuard` restores the Standard widget layout whenever a
 * custom dashboard was previously applied.
 */
export const DASHBOARD_TIME_TRACKING_ROUTE: PageRouteRegistryConfig = {
	location: 'dashboard-sections',
	path: DASHBOARD_TIME_TRACKING_PATH,
	canActivate: [standardDashboardGuard],
	loadChildren: () =>
		import('./dashboard-time-track-angular-ui.module').then((m) => m.DashboardTimeTrackAngularUiModule)
};

/**
 * Route config for the custom dashboards host (`/pages/dashboard/custom/:id`).
 *
 * A custom dashboard re-uses the Time Tracking widget system as its widget
 * host: `customDashboardGuard` applies the dashboard's persisted widget layout
 * (visibility/order/collapse state) into the widget system state BEFORE the
 * host component initializes, then the same lazy module renders it.
 */
export const DASHBOARD_CUSTOM_ROUTE: PageRouteRegistryConfig = {
	location: 'dashboard-sections',
	path: DASHBOARD_CUSTOM_PATH,
	canActivate: [customDashboardGuard],
	loadChildren: () =>
		import('./dashboard-time-track-angular-ui.module').then((m) => m.DashboardTimeTrackAngularUiModule)
};
