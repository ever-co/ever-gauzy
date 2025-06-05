import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthorizationComponent } from './components/make-com-authorize/make-com-authorize.component';
import { IntegrationMakeComLayoutComponent } from './integration-make-com.layout.component';
import { MakeComponent } from './components/make/make.component';
import { MakeComCallbackComponent } from './components/make-com-callback/make-com-callback.component';
import { MakeComSettingsComponent } from './components/make-com-settings/make-com-settings.component';

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
						path: 'callback',
						component: MakeComCallbackComponent
					},
					{
						path: ':id',
						component: MakeComponent,
						children: [
							{
								path: '',
								redirectTo: 'scenarios',
								pathMatch: 'full'
							},
							{
								path: 'scenarios',
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
								component: MakeComSettingsComponent
							}
						]
					}
				]
			}
		])
	],
	exports: [RouterModule]
})
export class IntegrationMakeComRoutes {}
