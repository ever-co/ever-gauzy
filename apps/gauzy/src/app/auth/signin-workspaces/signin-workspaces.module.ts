import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbLayoutModule, NbListModule, NbSpinnerModule } from '@nebular/theme';
import { ThemeModule } from '../../@theme/theme.module';
import { SignInWorkspacesLayoutComponent } from './signin-workspaces.component';
import { SignInWorkspacesLayoutRoutingModule } from './signin-workspaces-routing.module';
import { MultiWorkspaceOnboardingComponent } from './components/multi-workspace/multi-workspace.component';

@NgModule({
	imports: [
		CommonModule,
		NbCardModule,
		NbLayoutModule,
		NbListModule,
		NbSpinnerModule,
		ThemeModule,
		SignInWorkspacesLayoutRoutingModule,
	],
	declarations: [
		SignInWorkspacesLayoutComponent,
		MultiWorkspaceOnboardingComponent
	],
	providers: []
})
export class SignInWorkspacesLayoutModule { }
