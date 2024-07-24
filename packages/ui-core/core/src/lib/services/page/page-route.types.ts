import { Route } from '@angular/router';
import { PageRouteLocationId } from '../../common/component-registry-types';

/**
 * Page route configuration.
 */
export interface PageRouteConfig {
	/**
	 * The location identifier for the page route.
	 */
	location: PageRouteLocationId;

	/**
	 * The path to navigate to when the page is selected.
	 */
	path: string;

	/**
	 * The route configuration for the page route.
	 */
	route?: Route;
}
