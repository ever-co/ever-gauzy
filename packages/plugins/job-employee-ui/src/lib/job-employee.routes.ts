import { Route } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { PageRouteRegistryService, PermissionsGuard } from '@gauzy/ui-core/core';
import { JobEmployeeComponent } from './components/job-employee/job-employee.component';

/**
 * Creates jobs employee routes for the application
 *
 * @param _pageRouteRegistryService An instance of PageRouteRegistryService
 * @returns An array of Route objects
 */
export const createJobEmployeeRoutes = (_pageRouteRegistryService: PageRouteRegistryService): Route[] => [
	{
		path: '',
		component: JobEmployeeComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ORG_JOB_EMPLOYEE_VIEW],
				redirectTo: '/pages/jobs/search'
			}
		}
	}
];
