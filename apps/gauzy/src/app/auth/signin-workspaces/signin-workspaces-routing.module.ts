import { RouterModule, Routes } from '@angular/router';
import { NgModule } from '@angular/core';
import { SignInWorkspacesLayoutComponent } from './signin-workspaces.component';
import { MultiWorkspaceOnboardingComponent } from './components/multi-workspace/multi-workspace.component';

const routes: Routes = [
	{
		path: 'workspaces',
		component: SignInWorkspacesLayoutComponent,
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
export class SignInWorkspacesLayoutRoutingModule { }
