import { Route } from '@angular/router';
import { PageRegistryService } from '@gauzy/ui-core/core';
import { JobLayoutComponent } from './job-layout/job-layout.component';

/**
 * Creates jobs routes for the application
 *
 * @param _pageRegistryService An instance of PageRegistryService
 * @returns An array of Route objects
 */
export const createRoutes = (_pageRegistryService: PageRegistryService): Route[] => [
	{
		path: '',
		component: JobLayoutComponent,
		children: [
			{
				path: '',
				redirectTo: 'employee',
				pathMatch: 'full'
			},
			..._pageRegistryService.getPageLocationRoutes('jobs')
		]
	}
];
