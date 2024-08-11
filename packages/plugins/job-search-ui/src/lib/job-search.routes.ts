import { Route } from '@angular/router';
import { IntegrationEnum, PermissionsEnum } from '@gauzy/contracts';
import { IntegrationResolver, PageRouteService, PermissionsGuard } from '@gauzy/ui-core/core';
import { JobSearchComponent } from './components/job-search/job-search.component';

/**
 * Creates jobs browse routes for the application
 * @param _pageRouteService An instance of PageRouteService
 * @returns An array of Route objects
 */
export const createRoutes = (_pageRouteService: PageRouteService): Route[] => [
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
