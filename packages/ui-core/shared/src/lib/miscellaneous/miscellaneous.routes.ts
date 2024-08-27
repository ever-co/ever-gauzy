import { Route } from '@angular/router';
import { PageRouteRegistryService } from '@gauzy/ui-core/core';
import { MiscellaneousComponent } from './miscellaneous.component';
import { NotFoundComponent } from './components/not-found/not-found.component';

/**
 * Creates miscellaneous routes for the application
 *
 * @param _pageRouteRegistryService An instance of PageRouteRegistryService
 * @returns An array of Route objects
 */
export const createRoutes = (_pageRouteRegistryService: PageRouteRegistryService): Route[] => [
	{
		path: '',
		component: MiscellaneousComponent,
		children: [
			{
				path: '',
				redirectTo: '404',
				pathMatch: 'full'
			},
			{
				path: '404',
				component: NotFoundComponent
			}
		]
	}
];
