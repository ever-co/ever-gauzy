import { Type } from '@angular/core';
import { Route } from '@angular/router';
import { PageLocationRegistryId } from '../../common/component-registry.types';

/**
 * Page route configuration with additional route options.
 */
export interface PageRouteRegistryConfig extends Route {
	/**
	 * The location identifier for the page route.
	 */
	location: PageLocationRegistryId;

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

/**
 * Page registry service interface.
 */
export interface IPageRouteRegistry {
	registerPageRoute(config: PageRouteRegistryConfig): void; // Register a single page route configuration.
	registerPageRoutes(configs: PageRouteRegistryConfig[]): void; // Register multiple page route configurations.
}
