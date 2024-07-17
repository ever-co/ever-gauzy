import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { IntegrationEnum } from '@gauzy/contracts';
import { IntegrationResolver } from './../integration.resolver';
import { GithubWizardComponent } from './components/wizard/wizard.component';
import { GithubInstallationComponent } from './components/installation/installation.component';
import { GithubComponent } from './github.component';
import { GithubViewComponent } from './components/view/view.component';

const routes: Routes = [
	{
		path: '',
		component: GithubComponent,
		data: {
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
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class GithubRoutingModule {}
