import { Routes } from '@angular/router';
import { IntegrationEnum, PermissionsEnum } from '@gauzy/contracts';
import { IntegrationResolver, PermissionsGuard } from '@gauzy/ui-core/core';
import { SearchComponent } from './components/search/search.component';

/**
 * Creates the routes for the search component.
 *
 * @returns {Routes} The routes array.
 */
export const routes: Routes = [
	{
		path: '',
		component: SearchComponent,
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
