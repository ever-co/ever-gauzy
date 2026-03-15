import { Route } from '@angular/router';
import { BookmarkQueryParamsResolver, PageRouteRegistryConfig } from '@gauzy/ui-core/core';
import { DateRangePickerResolver } from '@gauzy/ui-core/shared';
import { TimeTrackingComponent } from './components/time-tracking/time-tracking.component';

/** Path segment for the Time Tracking tab under /pages/dashboard. */
export const DASHBOARD_TIME_TRACKING_PATH = 'time-tracking';

/**
 * Route config for registering the Angular Time Tracking tab at dashboard-sections.
 * Picked up by createDashboardRoutes via getPageLocationRoutes('dashboard-sections').
 */
export const DASHBOARD_TIME_TRACKING_ROUTE: PageRouteRegistryConfig = {
	location: 'dashboard-sections',
	path: DASHBOARD_TIME_TRACKING_PATH,
	loadChildren: () => import('./dashboard-time-track-angular-ui.module').then(
		(m) => m.DashboardTimeTrackAngularUiModule
	)
};

/**
 * Creates the child routes for the Time Tracking module.
 *
 * @returns Angular Route array for the time tracking feature.
 */
export function createTimeTrackingRoutes(): Route[] {
	return [
		{
			path: '',
			component: TimeTrackingComponent,
			data: {
				datePicker: {
					unitOfTime: 'week'
				}
			},
			resolve: {
				dates: DateRangePickerResolver,
				bookmarkParams: BookmarkQueryParamsResolver
			}
		}
	];
}

