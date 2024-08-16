import { Route } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { PageRegistryService, PermissionsGuard } from '@gauzy/ui-core/core';
import { JobMatchingComponent } from './components/job-matching/job-matching.component';

/**
 * Creates jobs matching routes for the application
 *
 * @param _pageRegistryService An instance of PageRegistryService
 * @returns An array of Route objects
 */
export const createRoutes = (_pageRegistryService: PageRegistryService): Route[] => [
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
