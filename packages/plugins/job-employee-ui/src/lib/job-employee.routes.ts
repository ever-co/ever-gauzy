import { Route } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { PageRegistryService, PermissionsGuard } from '@gauzy/ui-core/core';
import { JobEmployeeComponent } from './components/job-employee/job-employee.component';

/**
 * Creates jobs employee routes for the application
 *
 * @param _pageRegistryService An instance of PageRegistryService
 * @returns An array of Route objects
 */
export const createRoutes = (_pageRegistryService: PageRegistryService): Route[] => [
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
