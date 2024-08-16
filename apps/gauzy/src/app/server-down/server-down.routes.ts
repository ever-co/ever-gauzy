import { Route } from '@angular/router';
import { PageRegistryService } from '@gauzy/ui-core/core';
import { ServerDownComponent } from './server-down.component';

/**
 * Creates routes for the server down page.
 *
 * @param _pageRegistryService An instance of PageRegistryService
 * @returns An array of Route objects
 */
export const createRoutes = (_pageRegistryService: PageRegistryService): Route[] => [
	{
		path: '',
		component: ServerDownComponent
	}
];
