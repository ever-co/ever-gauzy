import { Route } from '@angular/router';
import { PageRouteRegistryConfig, PageRouteRegistryService, PageRouteLocationId } from '@gauzy/ui-core/core';
import { JobLayoutComponent } from './components/job-layout/job-layout.component';

/** Location where job child plugins (Employee, Search, Matching, etc.) register their routes. */
export const JOBS_SECTIONS_LOCATION: PageRouteLocationId = 'jobs-sections';

/** Default tab when navigating to /pages/jobs (redirects empty path). */
const DEFAULT_JOBS_TAB = 'employee';

/**
 * Route config for registering the jobs section at page-sections.
 * Used by JobsPlugin for declarative route registration.
 */
export const JOBS_PAGE_ROUTE: PageRouteRegistryConfig = {
	location: 'page-sections',
	path: 'jobs',
	loadChildren: () => import('./jobs.module').then((m) => m.JobsModule)
};

/**
 * Builds the child routes for the jobs section: layout + redirect + plugin-contributed tabs.
 *
 * @param registry Page route registry to fetch routes from JOBS_SECTIONS_LOCATION
 * @returns Route array for the ROUTES provider in JobsModule
 */
export function getJobsChildRoutes(registry: PageRouteRegistryService): Route[] {
	return [
		{
			path: '',
			component: JobLayoutComponent,
			children: [
				{ path: '', redirectTo: DEFAULT_JOBS_TAB, pathMatch: 'full' },
				...registry.getPageLocationRoutes(JOBS_SECTIONS_LOCATION)
			]
		}
	];
}
