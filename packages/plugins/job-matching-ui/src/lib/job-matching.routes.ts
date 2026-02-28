import { Route } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { PageRouteRegistryConfig, PermissionsGuard } from '@gauzy/ui-core/core';
import { JobMatchingComponent } from './components/job-matching/job-matching.component';

/** Path for the job matching tab under /pages/jobs. */
export const JOB_MATCHING_PATH = 'matching';

/** Full path for the job matching page. */
export const JOB_MATCHING_PAGE_LINK = `/pages/jobs/${JOB_MATCHING_PATH}`;

/** Route data selectors for the job matching page. */
const JOB_MATCHING_SELECTORS = {
	date: true,
	employee: true,
	project: false,
	team: false
} as const;

/**
 * Route config for registering the job matching section at jobs-sections.
 * Used by JobMatchingPlugin for declarative route registration.
 */
export const JOB_MATCHING_PAGE_ROUTE: PageRouteRegistryConfig = {
	location: 'jobs-sections',
	path: JOB_MATCHING_PATH,
	loadChildren: () => import('./job-matching.module').then((m) => m.JobMatchingModule),
	data: { selectors: { ...JOB_MATCHING_SELECTORS } }
};

/**
 * Returns the routes for the job matching section.
 *
 * @returns Route array for the ROUTES provider in JobMatchingModule
 */
export function getJobMatchingRoutes(): Route[] {
	return [
		{
			path: '',
			component: JobMatchingComponent,
			canActivate: [PermissionsGuard],
			data: {
				permissions: {
					only: [PermissionsEnum.ORG_JOB_MATCHING_VIEW],
					redirectTo: '/pages/dashboard'
				}
			}
		}
	];
}
