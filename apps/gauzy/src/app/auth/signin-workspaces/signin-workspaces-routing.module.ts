import { RouterModule, Routes } from '@angular/router';
import { NgModule } from '@angular/core';
import { SignInWorkspacesLayoutComponent } from './signin-workspaces.component';
import { MultiWorkspaceOnboardingComponent } from './components/multi-workspace/multi-workspace.component';
import { WorkspaceSigninWithEmailComponent } from './components/signin-with-email/signin-with-email.component';

const routes: Routes = [
	{
		path: '',
		component: SignInWorkspacesLayoutComponent,
		children: [
			{
				path: 'email',
				component: WorkspaceSigninWithEmailComponent
			},
			{
				path: 'workspaces',
				component: MultiWorkspaceOnboardingComponent
			}
		]
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class SignInWorkspacesLayoutRoutingModule { }
