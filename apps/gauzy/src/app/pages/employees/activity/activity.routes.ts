import { Route } from '@angular/router';
import { PageRouteRegistryService } from '@gauzy/ui-core/core';
import { ActivityLayoutComponent } from './layout/layout.component';
import { VideoAvailabilityResolver } from '@gauzy/plugin-videos-ui';

/**
 * Create and configures routes for the activity module.
 *
 * @param _pageRouteRegistryService - An instance of PageRouteRegistryService
 * @returns An array of Route objects
 */
export const createActivityRoutes = (_pageRouteRegistryService: PageRouteRegistryService): Route[] => [
	{
		path: '',
		component: ActivityLayoutComponent,
		resolve: { videoAvailability: VideoAvailabilityResolver },
		data: {
			tabsetId: 'time-activity'
		},
		children: [
			{
				path: '',
				redirectTo: 'time-activities',
				pathMatch: 'full'
			},
			..._pageRouteRegistryService.getPageLocationRoutes('time-activity')
		]
	}
];
