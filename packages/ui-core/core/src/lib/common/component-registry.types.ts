/**
 * @description
 * Type representing the possible component types for dynamic routes, tabs, and table columns.
 *
 * This type is used to identify different types of components that can be registered
 * for dynamic routes, tabs, and table columns. Each value corresponds to a specific
 * component type in the application. This allows for flexible and dynamic registration
 * based on the context and requirements of the application.
 *
 * Possible values:
 * - 'table': A table component.
 * - 'tab': A tab component.
 * - 'route': A route component.
 */
export type ComponentRegistryLocationId = 'table' | 'tab' | 'route';

/**
 * @description
 * Type representing the possible page locations for dynamic routes.
 *
 * This type is used to identify different sections of the application where dynamic
 * routes and tabs can be registered. Each value corresponds to a specific page or
 * section in the application. This allows for flexible and dynamic routing based
 * on the context and requirements of the application.
 *
 * Possible values:
 * - 'auth': The authentication section of the application.
 * - 'pages': The main pages section of the application.
 * - 'dashboard': The main dashboard page of the application.
 * - 'jobs': The jobs or job search section of the application.
 * - 'sales': The sales or proposals section of the application.
 * - 'proposals': A sub-page under the sales section.
 * - 'time-activity': A sub-page under the employees section.
 * - 'timesheet': A sub-page under the employees section.
 * - 'timesheet-details': A sub-page under the timesheet section.
 * - 'integrations': The integrations section of the application.
 */
export type PageRouteRegistryId =
	| 'auth'
	| 'pages'
	| 'dashboard'
	| 'jobs'
	| 'sales'
	| 'proposals'
	| 'time-activity'
	| 'timesheet'
	| 'timesheet-details'
	| 'integrations';

/**
 * @description
 * Type representing the possible dynamic tabs for pages.
 *
 * This type is used to identify different types of tabs that can be registered
 * for dynamic pages. Each value corresponds to a specific
 * tab type in the application. This allows for flexible and dynamic registration
 * based on the context and requirements of the application.
 *
 * Possible values:
 * - 'timesheet': A timesheet tab.
 * - 'time-activity': A time and activity tab.
 */
export type PageTabsetRegistryId = 'dashboard' | 'timesheet' | 'time-activity';

/**
 * @description
 * Type representing the possible page data table locations for dynamic table columns.
 *
 * This type is used to identify different sections of the application where dynamic
 * columns can be registered. Each value corresponds to a specific page or
 * section in the application. This allows for flexible and dynamic routing based
 * on the context and requirements of the application.
 *
 * Possible values:
 * - 'job-employee': A sub-page under the jobs section.
 */
export type PageDataTableRegistryId = 'job-employee';
