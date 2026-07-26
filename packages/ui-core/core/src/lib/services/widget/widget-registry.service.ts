import { Injectable, Type } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { IWidgetRegistry, WidgetCategory, WidgetPageLocationId, WidgetRegistryConfig } from './widget-registry.types';

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
	 * Global `widgetId` -> config index, so a persisted placement can resolve
	 * its widget without knowing which location registered it.
	 */
	private readonly byId = new Map<string, WidgetRegistryConfig>();

	/** Resolved component cache, so a widget dropped twice only loads once. */
	private readonly componentCache = new Map<string, Promise<Type<any>>>();

	private readonly _widgets$ = new BehaviorSubject<WidgetRegistryConfig[]>([]);

	/**
	 * All registered widgets, emitting again whenever registrations change
	 * (plugins register during app initialization and may be enabled later).
	 */
	public readonly widgets$: Observable<WidgetRegistryConfig[]> = this._widgets$.asObservable();

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

		// Index globally by id and publish the change to palette subscribers.
		this.byId.set(config.widgetId, config);
		this.publish();
	}

	/**
	 * Registers a widget, replacing any existing registration with the same id.
	 *
	 * Unlike {@link registerWidget} this never throws on duplicates, which makes
	 * it safe for hot module replacement and for plugins that re-register when
	 * they are toggled on and off at runtime.
	 *
	 * @param config - The configuration object for the widget.
	 */
	public registerOrReplaceWidget(config: WidgetRegistryConfig): void {
		if (!config?.location || !config?.widgetId) {
			throw new Error('A widget configuration must have location and widgetId properties');
		}

		const widgets = (this.registry.get(config.location) || []).filter(
			(widget: WidgetRegistryConfig) => widget.widgetId !== config.widgetId
		);
		widgets.push(config);
		this.registry.set(config.location, widgets);
		this.byId.set(config.widgetId, config);
		this.componentCache.delete(config.widgetId);
		this.publish();
	}

	/**
	 * Retrieves a widget configuration by its global id, regardless of the
	 * location it was registered at.
	 *
	 * @param widgetId - The registry key persisted on a dashboard placement.
	 * @returns The widget configuration, or `undefined` when it is not registered
	 *          (e.g. its plugin is disabled, or the widget was removed).
	 */
	public getWidget(widgetId: string): WidgetRegistryConfig | undefined {
		return this.byId.get(widgetId);
	}

	/**
	 * Streams the registered widgets, optionally narrowed to one palette category.
	 *
	 * @param category - Optional category filter.
	 */
	public getWidgets$(category?: WidgetCategory): Observable<WidgetRegistryConfig[]> {
		return this.widgets$.pipe(
			map((widgets: WidgetRegistryConfig[]) =>
				category ? widgets.filter((widget) => (widget.category ?? 'other') === category) : widgets
			)
		);
	}

	/**
	 * Resolves (and caches) the component class backing a widget.
	 *
	 * @param widgetId - The widget's registry key.
	 * @returns The component type, or `null` when the widget is unknown or
	 *          declares no component.
	 */
	public resolveComponent(widgetId: string): Promise<Type<any> | null> {
		const cached = this.componentCache.get(widgetId);
		if (cached) {
			return cached;
		}

		const config = this.byId.get(widgetId);
		if (!config?.loadComponent) {
			return Promise.resolve(null);
		}

		const loading = Promise.resolve(config.loadComponent());
		this.componentCache.set(widgetId, loading);
		// A failed load must not poison the cache — the next render retries.
		loading.catch(() => this.componentCache.delete(widgetId));
		return loading;
	}

	/** Emits the flattened registry to `widgets$` subscribers. */
	private publish(): void {
		this._widgets$.next(Array.from(this.byId.values()));
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
