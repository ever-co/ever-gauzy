import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { GithubAuthorizationComponent } from './components/authorization/authorization.component';
import { GithubInstallationsComponent } from './components/installations/installations.component';

const routes: Routes = [
	{
		path: '',
		children: [
			{
				path: '',
				redirectTo: 'authorization',
				pathMatch: 'full'
			},
			{
				path: 'authorization',
				component: GithubAuthorizationComponent,
			}
		]
	},
	{
		path: 'installations',
		component: GithubInstallationsComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class GithubRoutingModule { }
