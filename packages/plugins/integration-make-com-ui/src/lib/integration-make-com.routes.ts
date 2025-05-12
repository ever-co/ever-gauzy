import { Routes } from '@angular/router';
import { IntegrationMakeComLayoutComponent } from './integration-make-com.layout.component';

export const integrationMakeComRoutes: Routes = [
	{
		path: '',
		component: IntegrationMakeComLayoutComponent,
		children: [
			{
				path: '',
				redirectTo: 'settings',
				pathMatch: 'full'
			},
			{
				path: 'settings',
				loadChildren: () =>
					import('./components/settings/settings.module').then(
						(m) => m.SettingsModule
					)
			},
			{
				path: 'webhooks',
				loadChildren: () =>
					import('./components/webhooks/webhooks.module').then(
						(m) => m.WebhooksModule
					)
			},
			{
				path: 'scenarios',
				loadChildren: () =>
					import('./components/scenarios/scenarios.module').then(
						(m) => m.ScenariosModule
					)
			}
		]
	}
];
