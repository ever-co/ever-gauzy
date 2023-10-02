import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbButtonModule, NbCardModule, NbInputModule, NbLayoutModule, NbListModule, NbSpinnerModule } from '@nebular/theme';
import { ThemeModule } from '../../@theme/theme.module';
import { SignInWorkspacesLayoutComponent } from './signin-workspaces.component';
import { SignInWorkspacesLayoutRoutingModule } from './signin-workspaces-routing.module';
import { MultiWorkspaceOnboardingComponent } from './components/multi-workspace/multi-workspace.component';
import { WorkspaceSigninWithEmailComponent } from './components/signin-with-email/signin-with-email.component';
import { ThemeSelectorModule } from '../../@theme/components/theme-sidebar/theme-settings/components/theme-selector/theme-selector.module';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbCardModule,
		NbInputModule,
		NbLayoutModule,
		NbListModule,
		NbSpinnerModule,
		ThemeModule,
		ThemeSelectorModule,
		SignInWorkspacesLayoutRoutingModule,
	],
	declarations: [
		SignInWorkspacesLayoutComponent,
		MultiWorkspaceOnboardingComponent,
		WorkspaceSigninWithEmailComponent
	],
	providers: []
})
export class SignInWorkspacesLayoutModule { }
