import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { IntegrationEnum, PermissionsEnum } from '@gauzy/contracts';
import { PermissionsGuard } from '@gauzy/ui-core/core';
import { SearchComponent } from './search/search.component';
import { IntegrationResolver } from '../../integrations/integration.resolver';

const routes: Routes = [
	{
		path: '',
		component: SearchComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ORG_JOB_SEARCH],
				redirectTo: '/pages/jobs/search'
			},
			integration: IntegrationEnum.GAUZY_AI, // Custom data associated with this route
			relations: ['integration', 'entitySettings']
		},
		resolve: {
			integration: IntegrationResolver // Resolver to fetch data before activating the route
		}
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class SearchRoutingModule {}
