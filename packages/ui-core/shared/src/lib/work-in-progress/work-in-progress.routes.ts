import { Route } from '@angular/router';
import { PageRegistryService } from '@gauzy/ui-core/core';
import { WorkInProgressComponent } from './work-in-progress.component';

/**
 * Creates work in progress routes for the application
 *
 * @param _pageRegistryService An instance of PageRegistryService
 * @returns An array of Route objects
 */
export const createRoutes = (_pageRegistryService: PageRegistryService): Route[] => [
	{
		path: '',
		component: WorkInProgressComponent
	}
];
