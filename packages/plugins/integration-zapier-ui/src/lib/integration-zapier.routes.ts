import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { IntegrationZapierLayoutComponent } from './integration-zapier.layout.component';
import { ZapierAuthorizeComponent } from './components/zapier-authorize/zapier-authorize.component';
import { ZapierComponent } from './components/zapier/zapier.component';
import { ZapierSettingsComponent } from './components/zapier-settings/zapier-settings.component';

@NgModule({
	imports: [
		RouterModule.forChild([
			{
				path: '',
				component: IntegrationZapierLayoutComponent,
				children: [
					{
						path: '',
						redirectTo: 'authorize',
						pathMatch: 'full'
					},
					{
						path: 'authorize',
						component: ZapierAuthorizeComponent
					},
					{
						path: 'dashboard',
						component: ZapierComponent,
						children: [
							{
								path: '',
								redirectTo: 'zaps',
								pathMatch: 'full'
							},
							{
								path: 'zaps',
								loadChildren: () => import('@gauzy/ui-core/shared').then((m) => m.WorkInProgressModule)
							},
							{
								path: 'executions',
								loadChildren: () => import('@gauzy/ui-core/shared').then((m) => m.WorkInProgressModule)
							},
							{
								path: 'history',
								loadChildren: () => import('@gauzy/ui-core/shared').then((m) => m.WorkInProgressModule)
							},
							{
								path: 'settings',
								component: ZapierSettingsComponent
							}
						]
					}
				]
			}
		])
	],
	exports: [RouterModule]
})
export class IntegrationZapierRoutes {}
