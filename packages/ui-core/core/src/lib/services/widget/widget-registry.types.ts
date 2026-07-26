import { Type } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';

/**
 * The width of a widget in terms of grid columns.
 */
export type WidgetGridWidth = 3 | 4 | 6 | 8 | 12;

/**
 * Enum representing the possible widget page locations.
 *
 * This enum is used to identify different sections of the application where widgets can be registered.
 * Each value corresponds to a specific page or section in the application. This allows for flexible
 * and dynamic registration based on the context and requirements of the application.
 *
 * @readonly
 * @enum {string}
 */
export type WidgetPageLocationId = 'time-tracking' | 'accounting' | 'dashboard';

/**
 * Palette grouping for a widget. Drives the category accordion in the
 * dashboard builder's widget palette.
 */
export type WidgetCategory =
	| 'time-tracking'
	| 'accounting'
	| 'hr'
	| 'teams'
	| 'project-management'
	| 'plugin'
	| 'other';

/**
 * Ambient context every canvas-hosted widget receives (organization, date
 * range, and the currently selected employee/project/team scope).
 *
 * Declared here (rather than importing the concrete interface) so the registry
 * types stay dependency-free; the concrete shape is `IDashboardWidgetContext`
 * in `@gauzy/ui-core/core`'s dashboard services.
 */
export type WidgetContextRequirement = 'organization' | 'dateRange' | 'employee' | 'project' | 'team';

/**
 * A configurable setting exposed by a widget, rendered by the builder's
 * per-widget configuration dialog.
 */
export interface WidgetConfigField {
	key: string;
	label: string;
	type: 'text' | 'number' | 'boolean' | 'select' | 'employee' | 'project' | 'team';
	options?: { label: string; value: unknown }[];
	default?: unknown;
}

/**
 * Configuration for registering a widget.
 */
export interface WidgetRegistryConfig {
	/**
	 * @description
	 * The location of the widget in the application. This is used to determine
	 * where the widget should be rendered in the application.
	 *
	 * @example 'time-tracking'
	 */
	location: WidgetPageLocationId;

	/**
	 * @description
	 * Palette grouping for the dashboard builder. Widgets without a category
	 * are grouped under 'other'.
	 */
	category?: WidgetCategory;

	/**
	 * @description
	 * Eva/Nebular icon name shown on the palette entry.
	 *
	 * @example 'people-outline'
	 */
	icon?: string;

	/**
	 * @description
	 * Short description shown under the title in the palette. May be a
	 * translation key.
	 */
	description?: string | ResolveFn<string>;

	/**
	 * @description
	 * Default grid footprint used when the widget is dropped on a canvas,
	 * in a 12 column grid (`w`) and row units (`h`).
	 *
	 * @example { w: 3, h: 2 }
	 */
	defaultSize?: { w: number; h: number };

	/** Smallest footprint the widget may be resized to. */
	minSize?: { w: number; h: number };

	/** Largest footprint the widget may be resized to. */
	maxSize?: { w: number; h: number };

	/**
	 * @description
	 * Per-instance settings this widget accepts, rendered by the builder's
	 * configuration dialog and persisted in the placement's `config`.
	 */
	configSchema?: WidgetConfigField[];

	/**
	 * @description
	 * Ambient context the widget needs to render meaningful data. Used to show
	 * an actionable empty state (e.g. "select an employee") instead of a blank
	 * or broken widget.
	 */
	contextRequirements?: WidgetContextRequirement[];

	/**
	 * @description
	 * Feature flag gating the widget, mirroring plugin page extensions.
	 */
	featureKey?: string;

	/**
	 * @description
	 * The unique identifier of the widget. This ID is used to distinguish
	 * the widget from others and can be used to reference or load the widget
	 * in the application.
	 *
	 * @example 'weekly-activity'
	 */
	widgetId: string;

	/**
	 * @description
	 * The title of the widget. This title is typically used for display purposes,
	 * such as in headers or menus, to give users an understanding of the widget's
	 * purpose or content. The title can be:
	 *
	 * - A static string for a fixed title.
	 * - A resolver function that returns a promise or direct value of the title.
	 * - A translation key for a dynamic title.
	 *
	 * @example 'Time Tracking' // Static title
	 * @example () => Promise.resolve('Time Tracking') // Resolver function returning a promise
	 * @example () => 'Time Tracking' // Resolver function returning a direct value
	 */
	title?: string | ResolveFn<string>;

	/**
	 * @description
	 * Function that returns a promise or a direct type of the component to be loaded.
	 * This function is used to dynamically load the component associated with the widget.
	 * It allows for lazy loading of components to optimize performance and reduce initial
	 * load time.
	 *
	 * @example
	 * () => import('./weekly-activity-widget.component').then(m => m.WeeklyActivityWidgetComponent)
	 */
	loadComponent?: () => Promise<Type<any>> | Type<any>;

	/**
	 * @description
	 * Array of widths supported by the widget in the grid layout. Each width value
	 * corresponds to the number of columns the widget can span. This allows the widget
	 * to be responsive and adapt to different layout configurations.
	 *
	 * @example [3, 4, 6, 8, 12]
	 */
	supportedWidths?: WidgetGridWidth[];

	/**
	 * @description
	 * Array of permissions required to view or use the widget. Each permission is
	 * represented as a string, and these permissions are checked to ensure that the
	 * user has the necessary rights to access or interact with the widget.
	 *
	 * @example ['admin', 'user']
	 */
	permissions: string[] | PermissionsEnum[];
}

/**
 * Widget registry service interface.
 *
 * This interface defines the contract for services that manage widget registrations,
 * including methods for registering single and multiple widgets.
 */
export interface IWidgetRegistry {
	/**
	 * Registers a single widget with the service.
	 *
	 * This method adds a single widget configuration to the registry. If a widget with
	 * the same ID is already registered, an error will be thrown.
	 *
	 * @param config The configuration object for the widget to be registered.
	 */
	registerWidget(config: WidgetRegistryConfig): void;

	/**
	 * Registers multiple widgets with the service.
	 *
	 * This method adds multiple widget configurations to the registry. If any widget
	 * within the provided configurations already exists, an error will be thrown for that
	 * specific widget, but other widgets will still be registered.
	 *
	 * @param configs An array of configuration objects for the widgets to be registered.
	 */
	registerWidgets(configs: WidgetRegistryConfig[]): void;
}
