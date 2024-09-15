import { Injectable } from '@angular/core';
import { Route } from '@angular/router';
import { PageRouteRegistryId } from '../../common/component-registry.types';
import { IPageRouteRegistry, PageRouteRegistryConfig } from './page-route-registry.types';

@Injectable({
	providedIn: 'root'
})
export class PageRouteRegistryService implements IPageRouteRegistry {
	/**
	 * Registry for storing page route configurations.
	 *
	 * This Map stores arrays of PageRouteRegistryConfig objects, keyed by PageRouteRegistryId.
	 */
	private readonly registry = new Map<PageRouteRegistryId, PageRouteRegistryConfig[]>();

	/**
	 * Retrieves a read-only snapshot of the page route registry.
	 *
	 * This method returns a new `Map` instance based on the current state of the `registry`.
	 * This approach ensures that the original `registry` remains unchanged and protected
	 * from direct modifications, preserving encapsulation and immutability.
	 *
	 * @returns A `ReadonlyMap` containing the current page route registry. This map
	 *          provides a snapshot of the registry's state and cannot be modified,
	 *          ensuring that internal data integrity is maintained.
	 */
	public getRegistry(): ReadonlyMap<PageRouteRegistryId, PageRouteRegistryConfig[]> {
		// Create and return a new Map to provide an immutable view of the current registry state
		return new Map(this.registry);
	}

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
	registerPageRoute(config: PageRouteRegistryConfig): void {
		// Check if the configuration has a location property
		if (!config.location) {
			throw new Error('Page route configuration must have a location property');
		}

		// Get all registered routes for the specified location
		const routes = this.registry.get(config.location) || [];

		// Check if a route with the same location and path already exists
		const isMatchingRoute = routes.some(
			(route: PageRouteRegistryConfig) => route.location === config.location && route.path === config.path
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
	registerPageRoutes(configs: PageRouteRegistryConfig[]): void {
		configs.forEach((config) => this.registerPageRoute(config));
	}

	/**
	 * Filters out duplicate route configurations based on location and path combinations.
	 *
	 * @param configs The array of route configurations.
	 * @returns The array of unique route configurations.
	 */
	private _filterConfigs(configs: PageRouteRegistryConfig[]): PageRouteRegistryConfig[] {
		// Use a Set to track unique location combinations
		const location = new Set<string>();

		// Filter out duplicate configurations based on the location and path
		return configs.filter((config: PageRouteRegistryConfig) => {
			// Create a unique identifier for the combination of location and path
			const identifier = `${config.location}-${config.path}`;

			// Check if the unique identifier is already in the Set
			if (location.has(identifier)) {
				return false; // Duplicate found, filter it out
			}

			// Add the unique identifier to the Set
			location.add(identifier);
			return true; // Not a duplicate, keep it
		});
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
	getPageLocationRoutes(location: PageRouteRegistryId): Route[] {
		// Get all registered routes for the specified location
		let configs = this.registry.get(location) || [];

		// Filter out duplicate route configurations based on location combinations
		configs = this._filterConfigs(configs);

		// Map each route configuration to a route object
		return configs.map((config: PageRouteRegistryConfig) => {
			// Create a new route object
			const route: Route = {
				path: config.path, // Add path property
				pathMatch: config.path ? 'prefix' : 'full', // Set pathMatch property
				data: config.data || {}, // Add data property if it exists
				canActivate: config.canActivate || [] // Add canActivate property if it exists
			};

			// Check if the route configuration has a component or loadChildren property
			if (config.component) {
				// Set the component property to the config object
				route.component = config.component;
			} else if (config.loadChildren) {
				// Set the loadChildren property to the config object
				route.loadChildren = config.loadChildren;
			}

			// Check if the route configuration has a resolve property
			if (config.resolve) {
				// Set the resolve property to the config object
				route.resolve = config.resolve;
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
