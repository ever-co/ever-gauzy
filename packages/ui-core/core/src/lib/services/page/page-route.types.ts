import { Route } from '@angular/router';
import { PageRouteLocationId } from '../../common/component-registry-types';

/**
 * Page route configuration.
 */
export interface PageRouteLocationConfig {
	/**
	 * The location identifier for the page route.
	 */
	location: PageRouteLocationId;

	/**
	 * The path to navigate to when the page is selected.
	 */
	path: string;

	/**
	 * Optional component to render for the route.
	 */
	component?: any;

	/**
	 * Optional loadChildren function to load a module lazily.
	 */
	loadChildren?: () => Promise<any>;

	/**
	 * Optional data to associate with the route.
	 */
	data?: any;

	/**
	 * Optional guards to apply to the route.
	 */
	canActivate?: any[];

	/**
	 * Additional route configuration options.
	 */
	route?: Route;
}
