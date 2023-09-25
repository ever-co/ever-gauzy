import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { IntegrationEnum } from '@gauzy/contracts';
import { IntergrationResolver } from './../integration.resolver';
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
			integration: IntergrationResolver
		},
		children: [
			{
				path: ':integrationId',
				component: GithubViewComponent,
			},
			{
				path: 'setup',
				component: GithubViewComponent,
				children: [
					{
						path: 'wizard',
						component: GithubWizardComponent,
					},
					{
						path: 'installation',
						component: GithubInstallationComponent
					}
				]
			},
		]
	},
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class GithubRoutingModule { }
