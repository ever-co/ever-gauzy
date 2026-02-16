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
 * Type representing the possible page route locations for dynamic route registration.
 *
 * This type is used to identify different locations in the application where dynamic
 * routes can be registered. Each value corresponds to a specific page or section
 * location. This allows for flexible and dynamic routing based on the context
 * and requirements of the application.
 *
 * Possible values:
 * - 'auth-sections': The authentication section of the application.
 * - 'pages-sections': The main pages section of the application.
 * - 'dashboard-sections': The main dashboard page of the application.
 * - 'jobs-sections': The jobs or job search section of the application.
 * - 'sales-sections': The sales or proposals section of the application.
 * - 'proposals-sections': A sub-page under the sales section.
 * - 'time-activity-sections': A sub-page under the employees section.
 * - 'timesheet-sections': A sub-page under the employees section.
 * - 'timesheet-details-sections': A sub-page under the timesheet section.
 * - 'integrations-sections': The integrations section of the application.
 * - 'accounting-sections': Children under /pages/accounting.
 * - 'employees-sections': Children under /pages/employees.
 * - 'organization-sections': Children under /pages/organization.
 * - 'goals-sections': Children under /pages/goals.
 * - 'reports-sections': Children under /pages/reports.
 * - 'page-sections': Top-level plugin section routes under /pages.
 */
export type PageRouteLocationId =
	| 'auth-sections'
	| 'pages-sections'
	| 'dashboard-sections'
	| 'jobs-sections'
	| 'sales-sections'
	| 'proposals-sections'
	| 'time-activity-sections'
	| 'timesheet-sections'
	| 'timesheet-details-sections'
	| 'integrations-sections'
	| 'accounting-sections'
	| 'employees-sections'
	| 'organization-sections'
	| 'goals-sections'
	| 'reports-sections'
	| 'page-sections';

/**
 * @description
 * Type representing the possible dynamic tab pages.
 *
 * This type is used to identify different tab pages where tabs can be registered.
 * Each value corresponds to a specific tab page in the application.
 *
 * Possible values:
 * - 'dashboard-page': The dashboard tab page.
 * - 'timesheet-page': The timesheet tab page.
 * - 'time-activity-page': The time and activity tab page.
 * - 'employee-edit-page': The employee edit tab page.
 */
export type PageTabsetPageId = 'dashboard-page' | 'timesheet-page' | 'time-activity-page' | 'employee-edit-page';

/**
 * @description
 * Type representing the possible page data table locations for dynamic table columns.
 *
 * This type is used to identify different data table pages where dynamic
 * columns can be registered. Each value corresponds to a specific data table page.
 *
 * Possible values:
 * - 'employee-manage-page': Employee management data table page
 * - 'job-employee-page': Job employee data table page (under the jobs section)
 */
export type PageDataTablePageId = 'employee-manage-page' | 'job-employee-page';
