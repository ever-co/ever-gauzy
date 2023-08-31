import { RouterModule, Routes } from '@angular/router';
import { NgModule } from '@angular/core';
import { SigninWorksapcesLayoutComponent } from './signin-workspaces.component';
import { MultiWorkspaceOnboardingComponent } from './components/multi-workspace/multi-workspace.component';

const routes: Routes = [
	{
		path: 'workspaces',
		component: SigninWorksapcesLayoutComponent,
		children: [
			{
				path: '',
				component: MultiWorkspaceOnboardingComponent
			}
		]
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class SigninWorkspacesLayoutRoutingModule { }
