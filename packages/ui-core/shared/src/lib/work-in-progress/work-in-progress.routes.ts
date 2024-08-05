import { Route } from '@angular/router';
import { PageRouteService } from '@gauzy/ui-core/core';
import { WorkInProgressComponent } from './work-in-progress.component';

/**
 * Creates work in progress routes for the application
 *
 * @param _pageRouteService An instance of PageRouteService
 * @returns An array of Route objects
 */
export const createRoutes = (_pageRouteService: PageRouteService): Route[] => [
	{
		path: '',
		component: WorkInProgressComponent
	}
];
