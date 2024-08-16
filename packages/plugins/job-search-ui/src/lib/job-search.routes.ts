import { Route } from '@angular/router';
import { IntegrationEnum, PermissionsEnum } from '@gauzy/contracts';
import { IntegrationResolver, PageRegistryService, PermissionsGuard } from '@gauzy/ui-core/core';
import { JobSearchComponent } from './components/job-search/job-search.component';

/**
 * Creates jobs browse routes for the application
 *
 * @param _pageRegistryService An instance of PageRegistryService
 * @returns An array of Route objects
 */
export const createRoutes = (_pageRegistryService: PageRegistryService): Route[] => [
	{
		path: '',
		component: JobSearchComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ORG_JOB_SEARCH],
				redirectTo: '/pages/jobs/search'
			},
			integration: IntegrationEnum.GAUZY_AI,
			relations: ['integration', 'entitySettings']
		},
		resolve: { integration: IntegrationResolver }
	}
];
