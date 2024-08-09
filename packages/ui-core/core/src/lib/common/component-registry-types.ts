/**
 * @description
 * Type representing the possible page locations for dynamic routes and tabs.
 *
 * This type is used to identify different sections of the application where dynamic
 * routes and tabs can be registered. Each value corresponds to a specific page or
 * section in the application. This allows for flexible and dynamic routing based
 * on the context and requirements of the application.
 *
 * Possible values:
 * - 'dashboard': The main dashboard page of the application.
 * - 'jobs': The jobs or job search section of the application.
 */
export type PageRouteLocationId = 'dashboard' | 'jobs';
