import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { IntegrationEnum, PermissionsEnum } from '@gauzy/contracts';
import { IntegrationEntitySettingResolver, IntegrationResolver, IntegrationSettingResolver, PermissionsGuard } from '@gauzy/ui-core/core';
import { GauzyAIAuthorizationComponent } from './components/authorization/authorization.component';
import { GauzyAILayoutComponent } from './gauzy-ai.layout.component';
import { GauzyAIViewComponent } from './components/view/view.component';

const routes: Routes = [
	{
		path: '', // Empty path for the main route
		component: GauzyAILayoutComponent, // Component for the main layout
		data: {
			selectors: {
				project: false,
				team: false,
				employee: false,
				date: false
			}
		},
		children: [
			{
				path: '', // Child route for the default page
				component: GauzyAIAuthorizationComponent, // Component for the default page
				canActivate: [PermissionsGuard],
				data: {
					permissions: {
						only: [PermissionsEnum.INTEGRATION_ADD],
						redirectTo: '/pages/dashboard'
					},
					integration: IntegrationEnum.GAUZY_AI // Custom data associated with this route
				},
				resolve: {
					integration: IntegrationResolver // Resolver to fetch data before activating the route
				}
			},
			{
				path: 'reset', // Separate route for the reset page
				component: GauzyAIAuthorizationComponent, // Create a new component for the reset page
				canActivate: [PermissionsGuard],
				data: {
					permissions: {
						only: [PermissionsEnum.INTEGRATION_EDIT],
						redirectTo: '/pages/dashboard'
					},
					state: false,
					selectors: {
						project: false,
						team: false,
						employee: false,
						date: false
					}
				}
			},
			{
				path: ':id', // Child route with a parameter (id)
				component: GauzyAIViewComponent, // Component for the route with an id parameter
				resolve: {
					settings: IntegrationSettingResolver, // Resolver to fetch data before activating the route
					entitySettings: IntegrationEntitySettingResolver // Resolver to fetch entity settings before activating the route
				},
				data: {
					selectors: {
						project: false,
						team: false,
						employee: false,
						date: false
					}
				}
			}
		]
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class GauzyAIRoutingModule {}
