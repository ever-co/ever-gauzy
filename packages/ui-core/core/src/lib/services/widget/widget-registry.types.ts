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
export type WidgetPageLocationId = 'time-tracking' | 'accounting';

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
