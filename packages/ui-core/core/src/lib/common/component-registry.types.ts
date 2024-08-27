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

// Define sub-page types for 'jobs', 'employees' and 'sales'
export type JobsSubPageLocationRegistryId = 'job-employee';
export type SalesSubPageLocationRegistryId = 'proposals';

/**
 * @description
 * Type representing the possible page locations for dynamic routes, tabs, and table columns.
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
 * - 'job-employee': A sub-page under the jobs section.
 */
export type PageLocationRegistryId =
	| 'auth'
	| 'pages'
	| 'dashboard'
	| 'jobs'
	| JobsSubPageLocationRegistryId
	| 'sales'
	| SalesSubPageLocationRegistryId;

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
export type TabsetRegistryId = 'timesheet' | 'time-activity' | 'dashboard';

/**
 * Enum representing the possible dynamic tabs for pages.
 *
 * This enum is used to identify different types of tabs that can be registered
 * for dynamic pages. Each value corresponds to a specific
 * tab type in the application. This allows for flexible and dynamic registration
 * based on the context and requirements of the application.
 *
 * @readonly
 * @enum {string}
 */
export enum TabsetRegistryIdEnum {
	Timesheet = 'timesheet', // The identifier for the timesheet tabset
	TimeActivity = 'time-activity', // The identifier for the time and activity tabset
	Dashboard = 'dashboard' // The identifier for the dashboard tabset
}
