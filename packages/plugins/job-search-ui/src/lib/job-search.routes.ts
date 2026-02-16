import { Route } from '@angular/router';
import { IntegrationEnum, PermissionsEnum } from '@gauzy/contracts';
import { IntegrationResolver, PageRouteRegistryConfig, PermissionsGuard } from '@gauzy/ui-core/core';
import { JobSearchComponent } from './components/job-search/job-search.component';

/** Path for the job search (browse) tab under /pages/jobs. */
export const JOB_SEARCH_PATH = 'search';

/** Full path for the job search page. */
export const JOB_SEARCH_PAGE_LINK = `/pages/jobs/${JOB_SEARCH_PATH}`;

/** Route data selectors for the job search page. */
const JOB_SEARCH_SELECTORS = {
	date: true,
	employee: true,
	project: false,
	team: false
} as const;

/**
 * Route config for registering the job search (browse) section at jobs-sections.
 * Used by JobSearchPlugin for declarative route registration.
 */
export const JOB_SEARCH_PAGE_ROUTE: PageRouteRegistryConfig = {
	location: 'jobs-sections',
	path: JOB_SEARCH_PATH,
	loadChildren: () => import('./job-search.module').then((m) => m.JobSearchModule),
	data: { selectors: { ...JOB_SEARCH_SELECTORS } }
};

/**
 * Returns the routes for the job search (browse) section.
 *
 * @returns Route array for the ROUTES provider in JobSearchModule
 */
export function getJobSearchRoutes(): Route[] {
	return [
		{
			path: '',
			component: JobSearchComponent,
			canActivate: [PermissionsGuard],
			data: {
				permissions: {
					only: [PermissionsEnum.ORG_JOB_SEARCH],
					redirectTo: JOB_SEARCH_PAGE_LINK
				},
				integration: IntegrationEnum.GAUZY_AI,
				relations: ['integration', 'entitySettings']
			},
			resolve: { integration: IntegrationResolver }
		}
	];
}
