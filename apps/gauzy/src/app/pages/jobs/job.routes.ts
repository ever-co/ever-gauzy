import { Route } from '@angular/router';
import { PageRouteService } from '@gauzy/ui-core/core';
import { JobLayoutComponent } from './job-layout/job-layout.component';

/**
 * Creates jobs routes for the application
 * @param _pageRouteService An instance of PageRouteService
 * @returns An array of Route objects
 */
export const createRoutes = (_pageRouteService: PageRouteService): Route[] => [
	{
		path: '',
		component: JobLayoutComponent,
		children: _pageRouteService.getPageLocationRoutes('jobs')
	}
];
