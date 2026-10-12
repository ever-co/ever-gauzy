import { PreferredUiEnum } from '@gauzy/contracts';
import { PageRouteRegistryConfig, preferredUiCanMatch, standardDashboardGuard } from '@gauzy/ui-core/core';

/** Path segment for the Time Tracking tab under /pages/dashboard. */
export const DASHBOARD_TIME_TRACKING_PATH = 'time-tracking';

/**
 * Route config for registering the Angular Time Tracking tab at dashboard-sections.
 * Picked up by createDashboardRoutes via getPageLocationRoutes('dashboard-sections').
 *
 * `standardDashboardGuard` restores the Standard widget layout whenever a
 * custom dashboard was previously applied.
 *
 * `preferredUiCanMatch(ANGULAR)` is what makes this page ONE of two flavours: the React
 * Time Tracking plugin registers the very same path guarded with `PreferredUiEnum.REACT`,
 * and the router hands the URL to whichever flavour the tenant selected in
 * Settings → General. Bookmarks, the tab and the default-dashboard redirect are shared.
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
	canMatch: [preferredUiCanMatch(PreferredUiEnum.ANGULAR)],
	canActivate: [standardDashboardGuard],
	loadChildren: () =>
		import('./dashboard-time-track-angular-ui.module').then((m) => m.DashboardTimeTrackAngularUiModule)
};
