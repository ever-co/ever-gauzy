import { Injectable } from '@angular/core';
import { IWidgetRegistry, WidgetPageLocationId, WidgetRegistryConfig } from './widget-registry.types';

@Injectable({
	providedIn: 'root'
})
export class WidgetRegistryService implements IWidgetRegistry {
	/**
	 * @description
	 * Registry for storing page widget configurations.
	 *
	 * This Map stores arrays of WidgetRegistryConfig objects, keyed by WidgetPageLocationId.
	 */
	private readonly registry = new Map<WidgetPageLocationId, WidgetRegistryConfig[]>();

	/**
	 * Retrieves the current widget registry.
	 *
	 * This method returns a map of widget configurations, organized by their page locations.
	 *
	 * @returns A `Map` where each key is a `WidgetPageLocationId` and each value is an array of
	 *          `WidgetRegistryConfig` objects associated with that page location.
	 */
	public getRegistry(): ReadonlyMap<WidgetPageLocationId, WidgetRegistryConfig[]> {
		return new Map(this.registry); // Return a new Map to ensure immutability
	}

	/**
	 * Registers a single widget with the service.
	 *
	 * This method is responsible for registering a widget by adding its configuration
	 * to the widget registry. It ensures that the widget configuration includes the
	 * necessary properties (`widgetId` and `location`) before proceeding to add it
	 * to the registry. If any of these properties are missing, it throws an error.
	 *
	 * @param config - The configuration object for the widget to be registered.
	 * @throws Error - Throws an error if the `widgetId` or `location` properties are missing.
	 */
	public registerWidget(config: WidgetRegistryConfig): void {
		// Ensure the widget configuration includes a location.
		if (!config.location) {
			throw new Error('A widget configuration must have a location property');
		}

		// Ensure the widget configuration includes a unique identifier.
		if (!config.widgetId) {
			throw new Error('A widget configuration must have a widgetId property');
		}

		// Retrieve the existing widgets for the specified location from the registry,
		// or initialize an empty array if none exist.
		const widgets = this.registry.get(config.location) || [];

		// Check if a route with the same location and path already exists
		const isMatchingWidget = widgets.some(
			(widget: WidgetRegistryConfig) => widget.location === config.location && widget.widgetId === config.widgetId
		);

		// Check if a route with the same location already exists
		if (isMatchingWidget) {
			throw new Error(`Widget with id "${config.widgetId}" already exists at location "${config.location}"`);
		}

		// Add the new widget configuration to the list of widgets for the specified location
		widgets.push(config);

		// Update the registry with the new or updated list of widgets for the specified location.
		this.registry.set(config.location, widgets);
	}

	/**
	 * Registers multiple widgets with the service.
	 *
	 * This method adds multiple widget configurations to the registry. It processes each
	 * configuration sequentially by calling `registerWidget` for each one.
	 *
	 * @param configs An array of configuration objects for the widgets to be registered. Each
	 *                object in the array should follow the `WidgetRegistryConfig` schema.
	 * @throws Error if any widget ID is missing or if any widget ID already exists.
	 */
	public registerWidgets(configs: WidgetRegistryConfig[]): void {
		configs.forEach((config: WidgetRegistryConfig) => this.registerWidget(config));
	}

	/**
	 * Retrieves the widgets registered at a specific location.
	 *
	 * @param location - The location for which to retrieve the widgets.
	 *
	 * @returns An array of `WidgetRegistryConfig` objects registered at the specified location.
	 *          If no widgets are registered at the location, an empty array is returned.
	 */
	getLocationWidgets(location: WidgetPageLocationId): WidgetRegistryConfig[] {
		return this.registry.get(location) || [];
	}
}
