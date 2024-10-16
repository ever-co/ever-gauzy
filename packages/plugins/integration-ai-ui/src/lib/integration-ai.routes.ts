import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { IntegrationEnum, PermissionsEnum } from '@gauzy/contracts';
import {
	IntegrationEntitySettingResolver,
	IntegrationResolver,
	IntegrationSettingResolver,
	PermissionsGuard
} from '@gauzy/ui-core/core';
import { IntegrationAIAuthorizationComponent } from './components/authorization/authorization.component';
import { IntegrationAILayoutComponent } from './integration-ai.layout.component';
import { IntegrationAIViewComponent } from './components/view/view.component';

@NgModule({
	imports: [
		RouterModule.forChild([
			{
				path: '', // Empty path for the main route
				component: IntegrationAILayoutComponent, // Component for the main layout
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
						component: IntegrationAIAuthorizationComponent, // Component for the default page
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
						component: IntegrationAIAuthorizationComponent, // Create a new component for the reset page
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
						component: IntegrationAIViewComponent, // Component for the route with an id parameter
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
		])
	],
	exports: [RouterModule]
})
export class IntegrationAiRoutes {}
