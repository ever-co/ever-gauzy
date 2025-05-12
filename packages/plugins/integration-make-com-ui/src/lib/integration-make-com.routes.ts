import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { WebhooksComponent } from './components/webhooks/webhooks.component';
import { ScenariosComponent } from './components/scenarios/scenarios.component';
import { AuthorizationComponent } from './components/authorization/authorization.component';
import { IntegrationMakeComLayoutComponent } from './integration-make-com.layout.component';

@NgModule({
	imports: [
		RouterModule.forChild([
			{
				path: '',
				component: IntegrationMakeComLayoutComponent,
				children: [
					{
						path: '',
						component: AuthorizationComponent,
						data: { state: true }
					},
					{
						path: 'regenerate',
						component: AuthorizationComponent,
						data: { state: false }
					},
					{
						path: ':id',
						children: [
							{
								path: '',
								redirectTo: 'webhooks',
								pathMatch: 'full'
							},
							{
								path: 'webhooks',
								component: WebhooksComponent
							},
							{
								path: 'scenarios',
								component: ScenariosComponent
							}
						]
					},
					{
						path: ':id/settings',
						loadChildren: () => import('@gauzy/ui-core/shared').then((m) => m.WorkInProgressModule)
					}
				]
			}
		])
	],
	exports: [RouterModule]
})
export class IntegrationMakeComRoutes {}
