import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { IntegrationEnum } from '@gauzy/contracts';
import { SearchComponent } from './search/search.component';
import { IntegrationResolver } from '../../integrations/integration.resolver';

const routes: Routes = [
	{
		path: '',
		component: SearchComponent,
		data: {
			integration: IntegrationEnum.i4net_AI, // Custom data associated with this route
			relations: ['integration', 'entitySettings']
		},
		resolve: {
			integration: IntegrationResolver, // Resolver to fetch data before activating the route
		},
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class SearchRoutingModule { }
