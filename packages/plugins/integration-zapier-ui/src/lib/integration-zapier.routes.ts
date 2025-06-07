import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ZapierAuthorizeComponent } from './components/zapier-authorize/zapier-authorize.component';
import { IntegrationZapierLayoutComponent } from './integration-zapier.layout.component';
import { ZapierComponent } from './components/zapier/zapier.component';
import { ZapierCallbackComponent } from './components/zapier-callback/zapier-callback.component';
import { ZapierSettingsComponent } from './components/zapier-settings/zapier-settings.component';
import { ZapierTriggersComponent } from './components/zapier-triggers/zapier-triggers.component';
import { ZapierActionsComponent } from './components/zapier-actions/zapier-actions.component';
import { ZapierWebhooksComponent } from './components/zapier-webhooks/zapier-webhooks.component';

@NgModule({
	imports: [
		RouterModule.forChild([
			{
				path: '',
				component: IntegrationZapierLayoutComponent,
				children: [
					{
						path: '',
						component: ZapierAuthorizeComponent,
						data: { state: true }
					},
					{
						path: 'regenerate',
						component: ZapierAuthorizeComponent,
						data: { state: false }
					},
					{
						path: 'callback',
						component: ZapierCallbackComponent
					},
					{
						path: ':id',
						component: ZapierComponent,
						children: [
							{
								path: '',
								redirectTo: 'triggers',
								pathMatch: 'full'
							},
							{
								path: 'triggers',
								component: ZapierTriggersComponent
							},
							{
								path: 'actions',
								component: ZapierActionsComponent
							},
							{
								path: 'webhooks',
								component: ZapierWebhooksComponent
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
