import { Route } from '@angular/router';
import { PageRouteRegistryService } from '@gauzy/ui-core/core';
import { JobLayoutComponent } from './job-layout/job-layout.component';

/**
 * Creates jobs routes for the application.
 * Child routes are registered by job plugins (JobEmployeePlugin, JobSearchPlugin, etc.)
 * via PageRouteRegistryService under location 'jobs'.
 *
 * @param _pageRouteRegistryService An instance of PageRouteRegistryService
 * @returns An array of Route objects
 */
export const createJobsRoutes = (_pageRouteRegistryService: PageRouteRegistryService): Route[] => [
	{
		path: '',
		component: JobLayoutComponent,
		children: [
			{
				path: '',
				redirectTo: 'employee',
				pathMatch: 'full'
			},
			..._pageRouteRegistryService.getPageLocationRoutes('jobs-sections')
		]
	}
];
