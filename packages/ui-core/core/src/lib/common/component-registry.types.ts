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

// Define sub-page types for 'jobs'
type JobsSubPageLocationRegistryId = 'job-employee';
type SalesSubPageLocationRegistryId = 'proposals';

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
