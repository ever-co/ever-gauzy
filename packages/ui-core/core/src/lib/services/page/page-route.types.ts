import { Type } from '@angular/core';
import { Route } from '@angular/router';
import { PageRouteLocationId } from '../../common/component-registry-types';

/**
 * Page route configuration with additional route options.
 */
export interface PageRouteConfig extends Route {
	/**
	 * The location identifier for the page route.
	 */
	location: PageRouteLocationId;

	/**
	 * The path to navigate to when the page is selected.
	 */
	path: string;

	/**
	 * The component to instantiate when the path matches.
	 * Can be empty if child routes specify components.
	 */
	component?: Type<any>;

	/**
	 * Optional loadChildren function to load a module lazily.
	 */
	loadChildren?: () => Promise<Type<any>> | Type<any>;

	/**
	 * Additional route configuration options.
	 */
	route?: Route;
}
