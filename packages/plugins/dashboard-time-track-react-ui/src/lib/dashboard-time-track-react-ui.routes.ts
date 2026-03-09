import { PageRouteRegistryConfig } from '@gauzy/ui-core/core';
import { DashboardTimeTrackReactUiPageComponent } from './dashboard-time-track-react-ui-page.component';

/** Path segment for the Dashboard Time Track tab under /pages/dashboard. */
export const DASHBOARD_TIME_TRACK_PATH = 'dashboard-time-track';

/**
 * Route config for registering the Dashboard Time Track tab at dashboard-sections.
 * Picked up by createDashboardRoutes via getPageLocationRoutes('dashboard-sections').
 */
export const DASHBOARD_TIME_TRACK_ROUTE: PageRouteRegistryConfig = {
	location: 'dashboard-sections',
	path: DASHBOARD_TIME_TRACK_PATH,
	component: DashboardTimeTrackReactUiPageComponent
};
