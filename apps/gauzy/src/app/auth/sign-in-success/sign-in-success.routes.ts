import { Route } from '@angular/router';
import { PageRouteService } from '@gauzy/ui-core/core';
import { SignInSuccessComponent } from './sign-in-success.component';

/**
 * Creates signin success routes for the application
 *
 * @param _pageRouteService An instance of PageRouteService
 * @returns An array of Route objects
 */
export const createRoutes = (_pageRouteService: PageRouteService): Route[] => [
	{
		path: 'success',
		component: SignInSuccessComponent
	},
	{
		path: 'google',
		component: SignInSuccessComponent
	}
];
