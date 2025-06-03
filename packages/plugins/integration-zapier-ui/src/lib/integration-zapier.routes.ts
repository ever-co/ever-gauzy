import { Routes } from '@angular/router';
import { IntegrationZapierLayoutComponent } from './integration-zapier.layout.component';
import { ZapierAuthorizeComponent } from './components/zapier-authorize/zapier-authorize.component';

export const integrationZapierRoutes: Routes = [
	{
		path: '',
		component: IntegrationZapierLayoutComponent,
		children: [
			{
				path: '',
				redirectTo: 'zapier-authorize',
				pathMatch: 'full'
			},
			{
				path: 'zapier-authorize',
				component: ZapierAuthorizeComponent
			}
		]
	}
];
