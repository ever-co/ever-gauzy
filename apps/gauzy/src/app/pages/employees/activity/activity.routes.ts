import { Route } from '@angular/router';
import { PageRouteRegistryService } from '@gauzy/ui-core/core';
import { ActivityLayoutComponent } from './layout/layout.component';

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
		data: {
			tabsetId: 'time-activity'
		},
		children: [
			{
				path: '',
				redirectTo: 'time-activities',
				pathMatch: 'full'
			},
			{
				path: 'screenshots',
				loadChildren: () => import('./screenshot/screenshot.module').then((m) => m.ScreenshotModule)
			},
			{
				path: '',
				loadChildren: () =>
					import('./app-url-activity/app-url-activity.module').then((m) => m.AppUrlActivityModule)
			},
			..._pageRouteRegistryService.getPageLocationRoutes('time-activity')
		]
	}
];
