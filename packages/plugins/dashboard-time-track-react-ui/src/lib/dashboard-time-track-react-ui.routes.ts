import { PreferredUiEnum } from '@gauzy/contracts';
import {
	BookmarkQueryParamsResolver,
	PageRouteRegistryConfig,
	preferredUiCanMatch,
	standardDashboardGuard
} from '@gauzy/ui-core/core';
import { DateRangePickerResolver } from '@gauzy/ui-core/shared';
import { DashboardTimeTrackReactUiPageComponent } from './dashboard-time-track-react-ui-page.component';

/**
 * Path segment of the Time Tracking tab under /pages/dashboard.
 *
 * Deliberately the SAME segment the Angular Time Tracking plugin registers: the two plugins are
 * two flavours of one page. Each registration carries a `preferredUiCanMatch` guard, so the
 * router hands `/pages/dashboard/time-tracking` to whichever flavour the tenant selected in
 * Settings → General ("Preferred UI"). Bookmarks, the dashboard tab and the default-dashboard
 * redirect therefore never change when a tenant switches.
 */
export const DASHBOARD_TIME_TRACK_PATH = 'time-tracking';

/**
 * Route config for registering the React Time Tracking tab at dashboard-sections.
 * Picked up by createDashboardRoutes via getPageLocationRoutes('dashboard-sections').
 *
 * Includes DateRangePickerResolver and BookmarkQueryParamsResolver so that
 * navigating directly to this route (or hard-refreshing) initializes the
 * date-range state that useDateRangeFilters() depends on, and
 * `standardDashboardGuard` so a previously applied custom dashboard layout is
 * restored to the Standard one exactly like the Angular flavour does.
 */
export const DASHBOARD_TIME_TRACK_ROUTE: PageRouteRegistryConfig = {
	location: 'dashboard-sections',
	path: DASHBOARD_TIME_TRACK_PATH,
	canMatch: [preferredUiCanMatch(PreferredUiEnum.REACT)],
	canActivate: [standardDashboardGuard],
	component: DashboardTimeTrackReactUiPageComponent,
	data: {
		datePicker: {
			unitOfTime: 'week'
		}
	},
	resolve: {
		dates: DateRangePickerResolver,
		bookmarkParams: BookmarkQueryParamsResolver
	}
};
