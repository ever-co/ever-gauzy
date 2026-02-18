import { PermissionsEnum } from '@gauzy/contracts';
import { PageRouteRegistryConfig, PermissionsGuard } from '@gauzy/ui-core/core';
import { JobEmployeeComponent } from './components/job-employee/job-employee.component';

/** Path for the job employee tab under /pages/jobs. */
export const JOB_EMPLOYEE_PATH = 'employee';

/** Full path for the job employee page. */
export const JOB_EMPLOYEE_PAGE_LINK = `/pages/jobs/${JOB_EMPLOYEE_PATH}`;

/** Route data selectors for the job employee page. */
const JOB_EMPLOYEE_SELECTORS = {
	date: true,
	employee: true,
	project: false,
	team: false
} as const;

/**
 * Route config for registering the job employee section at jobs-sections.
 * Used by JobEmployeePlugin for declarative route registration.
 */
export const JOB_EMPLOYEE_PAGE_ROUTE: PageRouteRegistryConfig = {
	location: 'jobs-sections',
	path: JOB_EMPLOYEE_PATH,
	component: JobEmployeeComponent,
	canActivate: [PermissionsGuard],
	data: {
		tabsetId: 'job-employee',
		dataTableId: 'job-employee-page',
		selectors: { ...JOB_EMPLOYEE_SELECTORS },
		permissions: {
			only: [PermissionsEnum.ORG_JOB_EMPLOYEE_VIEW],
			redirectTo: '/pages/jobs/search'
		}
	}
};
