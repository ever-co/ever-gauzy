import { PageRouteRegistryConfig, standardDashboardGuard } from '@gauzy/ui-core/core';

/** Path segment for the Time Tracking tab under /pages/dashboard. */
export const DASHBOARD_TIME_TRACKING_PATH = 'time-tracking';

/**
 * Route config for registering the Angular Time Tracking tab at dashboard-sections.
 * Picked up by createDashboardRoutes via getPageLocationRoutes('dashboard-sections').
 *
 * `standardDashboardGuard` restores the Standard widget layout whenever a
 * custom dashboard was previously applied.
 *
 * NOTE: the custom dashboard host (`custom/:id`) used to be registered here and
 * lazy-loaded THIS module — i.e. a custom dashboard was the Time Tracking page
 * with a different saved permutation. It now lives in the core dashboard
 * feature as its own canvas page (see `createDashboardRoutes`), and this plugin
 * instead contributes its counters to the builder palette as registered widgets.
 */
export const DASHBOARD_TIME_TRACKING_ROUTE: PageRouteRegistryConfig = {
	location: 'dashboard-sections',
	path: DASHBOARD_TIME_TRACKING_PATH,
	canActivate: [standardDashboardGuard],
	loadChildren: () =>
		import('./dashboard-time-track-angular-ui.module').then((m) => m.DashboardTimeTrackAngularUiModule)
};
