import { Route } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { PageRouteRegistryService, PermissionsGuard } from '@gauzy/ui-core/core';
import { JobMatchingComponent } from './components/job-matching/job-matching.component';

/**
 * Creates jobs matching routes for the application
 *
 * @param _pageRouteRegistryService An instance of PageRouteRegistryService
 * @returns An array of Route objects
 */
export const createJobMatchingRoutes = (_pageRouteRegistryService: PageRouteRegistryService): Route[] => [
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
