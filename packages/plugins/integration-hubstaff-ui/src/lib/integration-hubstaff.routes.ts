import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { HubstaffAuthorizeComponent } from './components/hubstaff-authorize/hubstaff-authorize.component';
import { HubstaffComponent } from './components/hubstaff/hubstaff.component';
import { IntegrationHubstaffLayoutComponent } from './integration-hubstaff.layout.component';

@NgModule({
	imports: [
		RouterModule.forChild([
			{
				path: '',
				component: IntegrationHubstaffLayoutComponent,
				children: [
					{
						path: '',
						component: HubstaffAuthorizeComponent,
						data: {
							state: true
						}
					},
					{
						path: 'regenerate',
						component: HubstaffAuthorizeComponent,
						data: {
							state: false
						}
					},
					{
						path: ':id',
						component: HubstaffComponent
					}
				]
			}
		])
	],
	exports: [RouterModule]
})
export class IntegrationHubstaffRoutes {}
