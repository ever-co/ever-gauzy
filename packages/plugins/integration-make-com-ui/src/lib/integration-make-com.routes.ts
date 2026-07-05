import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthorizationComponent } from './components/make-com-authorize/make-com-authorize.component';
import { IntegrationMakeComLayoutComponent } from './integration-make-com.layout.component';
import { MakeComponent } from './components/make/make.component';
import { MakeComCallbackComponent } from './components/make-com-callback/make-com-callback.component';
import { MakeComSettingsComponent } from './components/make-com-settings/make-com-settings.component';
import { MakeComScenariosComponent } from './components/make-com-scenarios/make-com-scenarios.component';
import { MakeComHooksComponent } from './components/make-com-hooks/make-com-hooks.component';
import { MakeComConnectionsComponent } from './components/make-com-connections/make-com-connections.component';
import { MakeComTemplatesComponent } from './components/make-com-templates/make-com-templates.component';

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
								component: MakeComScenariosComponent
							},
							{
								path: 'executions',
								redirectTo: 'hooks',
								pathMatch: 'full'
							},
							{
								path: 'history',
								redirectTo: 'connections',
								pathMatch: 'full'
							},
							{
								path: 'hooks',
								component: MakeComHooksComponent
							},
							{
								path: 'connections',
								component: MakeComConnectionsComponent
							},
							{
								path: 'templates',
								component: MakeComTemplatesComponent
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
