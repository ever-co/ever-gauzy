import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { GithubWizardComponent } from './components/wizard/wizard.component';
import { GithubInstallationComponent } from './components/installation/installation.component';

const routes: Routes = [
	{
		path: '',
		children: [
			{
				path: '',
				redirectTo: 'wizard',
				pathMatch: 'full'
			},
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
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class GithubRoutingModule { }
