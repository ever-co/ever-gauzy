import { Injectable } from '@angular/core';
import { Route } from '@angular/router';
import { PageRouteConfig } from './page-route.types';
import { PageRouteLocationId } from '../../common/component-registry-types';

@Injectable({
	providedIn: 'root'
})
export class PageRouteService {
	/**
	 * Registry for storing page route configurations.
	 *
	 * This Map stores arrays of PageRouteConfig objects, keyed by PageRouteLocationId.
	 */
	private readonly registry = new Map<PageRouteLocationId, PageRouteConfig[]>();

	/**
	 * Register a single page route configuration.
	 *
	 * This method registers a new page route configuration in the service's internal registry.
	 * It ensures that the configuration has a valid location property and checks if a route
	 * with the same location already exists to prevent duplicate entries. If the configuration
	 * is valid and unique, it adds it to the registry.
	 *
	 * @param config The configuration for the page route.
	 * @throws Will throw an error if the configuration does not have a location property.
	 * @throws Will throw an error if a route with the same location has already been registered.
	 */
	registerPageRoute(config: PageRouteConfig): void {
		// Check if the configuration has a location property
		if (!config.location) {
			throw new Error('Page route configuration must have a location property');
		}

		// Get all registered routes for the specified location
		const routes = this.registry.get(config.location) || [];

		// Check if a route with the same location and path already exists
		const isMatchingRoute = routes.some(
			(route: PageRouteConfig) => route.location === config.location && route.path === config.path
		);

		// Check if a route with the same location already exists
		if (isMatchingRoute) {
			throw new Error(
				`A page with the location "${config.location}" and path "${config.path}" has already been registered`
			);
		}

		// Add the new route configuration to the list of routes for the specified location
		routes.push(config);

		// Update the registry with the new list of routes for the specified location
		this.registry.set(config.location, routes);
	}

	/**
	 * Register multiple page route configurations.
	 *
	 * This method registers multiple new page route configurations in the service's internal registry.
	 * It ensures that each configuration has a valid location property and checks if a route with the same
	 * location already exists to prevent duplicate entries. If the configurations are valid and unique,
	 * it adds them to the registry.
	 *
	 * @param configs The array of configurations for the page routes.
	 * @throws Will throw an error if a route with the same location and path has already been registered.
	 */
	registerPageRoutes(configs: PageRouteConfig[]): void {
		configs.forEach((config) => this.registerPageRoute(config));
	}

	/**
	 * Get all registered routes for a specific location.
	 *
	 * This method retrieves all registered route configurations for a specified location identifier.
	 * It maps the internal route configurations to Angular Route objects.
	 *
	 * @param location The page location identifier.
	 * @returns The array of registered routes for the specified location.
	 */
	getPageLocationRoutes(location: PageRouteLocationId): Route[] {
		// Get all registered routes for the specified location
		let configs = this.registry.get(location) || [];

		// Use a Set to track unique location-path combinations
		const locationPaths = new Set<string>();

		// Create a unique identifier for the combination of location and path
		configs = configs.filter((config: PageRouteConfig) => {
			// Create a unique identifier for the combination of location and path
			const identifier = `${config.location}-${config.path}`;

			// Check if the unique identifier is already in the Set
			if (locationPaths.has(identifier)) {
				return false; // Duplicate found, filter it out
			}

			// Add the unique identifier to the Set
			locationPaths.add(identifier);
			return true; // Not a duplicate, keep it
		});

		// Map each route configuration to a route object
		return configs.map((config: PageRouteConfig) => {
			// Create a new route object
			const route: Route = {
				path: config.path,
				pathMatch: config.path ? 'prefix' : 'full',
				data: config.data || {},
				canActivate: config.canActivate || []
			};

			// Check if the route configuration has a component or loadChildren property
			if (config.component) {
				// Set the component property to the config object
				route.component = config.component;
			} else if (config.loadChildren) {
				// Set the loadChildren property to the config object
				route.loadChildren = config.loadChildren;
			}

			// Check if the route configuration has additional route options
			if (config.route) {
				Object.assign(route, config.route);
			}

			// Return the route object
			return route;
		});
	}
}
