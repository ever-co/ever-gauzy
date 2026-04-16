import { PageRouteRegistryConfig } from '@gauzy/ui-core/core';

/** Path segment for the Time Tracking tab under /pages/dashboard. */
export const DASHBOARD_TIME_TRACKING_PATH = 'time-tracking';

/**
 * Route config for registering the Angular Time Tracking tab at dashboard-sections.
 * Picked up by createDashboardRoutes via getPageLocationRoutes('dashboard-sections').
 */
export const DASHBOARD_TIME_TRACKING_ROUTE: PageRouteRegistryConfig = {
	location: 'dashboard-sections',
	path: DASHBOARD_TIME_TRACKING_PATH,
	loadChildren: () =>
		import('./dashboard-time-track-angular-ui.module').then((m) => m.DashboardTimeTrackAngularUiModule)
};
