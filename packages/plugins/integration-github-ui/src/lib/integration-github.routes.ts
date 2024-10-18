import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { IntegrationEnum, PermissionsEnum } from '@gauzy/contracts';
import { IntegrationResolver, PermissionsGuard } from '@gauzy/ui-core/core';
import { GithubWizardComponent } from './components/wizard/wizard.component';
import { GithubInstallationComponent } from './components/installation/installation.component';
import { IntegrationGithubLayoutComponent } from './integration-github.layout.component';
import { GithubViewComponent } from './components/view/view.component';

@NgModule({
	imports: [
		RouterModule.forChild([
			{
				path: '',
				component: IntegrationGithubLayoutComponent,
				canActivate: [PermissionsGuard],
				data: {
					permissions: {
						only: [PermissionsEnum.INTEGRATION_ADD],
						redirectTo: '/pages/dashboard'
					},
					integration: IntegrationEnum.GITHUB
				},
				resolve: {
					integration: IntegrationResolver
				},
				runGuardsAndResolvers: 'always',
				children: [
					{
						path: ':integrationId',
						component: GithubViewComponent,
						data: { selectors: false }
					},
					{
						path: 'setup/wizard',
						component: GithubWizardComponent
					}
				]
			},
			{
				path: 'setup/wizard/reset',
				component: GithubWizardComponent,
				data: {
					selectors: false,
					redirectTo: '/pages/integrations/github/setup/wizard'
				}
			},
			{
				path: 'setup/installation',
				component: GithubInstallationComponent
			}
		])
	],
	exports: [RouterModule]
})
export class IntegrationGithubRoutes {}
