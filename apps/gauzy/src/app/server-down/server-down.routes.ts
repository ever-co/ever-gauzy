import { Route } from '@angular/router';
import { PageRouteService } from '@gauzy/ui-core/core';
import { ServerDownComponent } from './server-down.component';

/**
 * Creates routes for the server down page.
 *
 * @param _pageRouteService An instance of PageRouteService
 * @returns An array of Route objects
 */
export const createRoutes = (_pageRouteService: PageRouteService): Route[] => [
	{
		path: '',
		component: ServerDownComponent
	}
];
