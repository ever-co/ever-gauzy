import { PageRouteRegistryConfig } from '@gauzy/ui-core/core';
import { ReactTimeTrackingPageComponent } from './react-time-tracking-page.component';

/** Path segment for the React Time Tracking tab under /pages/dashboard. */
export const REACT_TIME_TRACKING_PATH = 'react-time-tracking';

/**
 * Route config for registering the React Time Tracking tab at dashboard-sections.
 * Picked up by createDashboardRoutes via getPageLocationRoutes('dashboard-sections').
 */
export const REACT_TIME_TRACKING_DASHBOARD_ROUTE: PageRouteRegistryConfig = {
	location: 'dashboard-sections',
	path: REACT_TIME_TRACKING_PATH,
	component: ReactTimeTrackingPageComponent
};
