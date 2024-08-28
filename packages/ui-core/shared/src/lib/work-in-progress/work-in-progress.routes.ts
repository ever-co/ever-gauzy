import { Route } from '@angular/router';
import { PageRouteRegistryService } from '@gauzy/ui-core/core';
import { WorkInProgressComponent } from './work-in-progress.component';

/**
 * Creates work in progress routes for the application
 *
 * @param _pageRouteRegistryService An instance of PageRouteRegistryService
 * @returns An array of Route objects
 */
export const createWorkInProgressRoutes = (_pageRouteRegistryService: PageRouteRegistryService): Route[] => [
	{
		path: '',
		component: WorkInProgressComponent
	}
];
