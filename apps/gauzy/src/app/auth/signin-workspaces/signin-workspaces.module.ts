import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbButtonModule,
	NbCardModule,
	NbIconModule,
	NbInputModule,
	NbLayoutModule,
	NbListModule,
	NbRadioModule,
	NbSpinnerModule,
	NbUserModule
} from '@nebular/theme';
import { ThemeModule } from '../../@theme/theme.module';
import { ThemeSelectorModule } from '../../@theme/components/theme-sidebar/theme-settings/components/theme-selector/theme-selector.module';
import { PasswordFormFieldModule } from '../../@shared/user/forms/fields/password';
import { TranslateModule } from '../../@shared/translate/translate.module';
import { SignInWorkspacesLayoutComponent } from './signin-workspaces.component';
import { SignInWorkspacesLayoutRoutingModule } from './signin-workspaces-routing.module';
import { MultiWorkspaceOnboardingComponent } from './components/multi-workspace/multi-workspace.component';
import { WorkspaceSigninWithEmailComponent } from './components/signin-with-email/signin-with-email.component';
import { SharedModule } from '../../@shared/shared.module';

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
		NbRadioModule,
		NbSpinnerModule,
		NbUserModule,
		ThemeModule,
		TranslateModule,
		ThemeSelectorModule,
		SignInWorkspacesLayoutRoutingModule,
		PasswordFormFieldModule,
		NbIconModule,
		SharedModule
	],
	declarations: [
		SignInWorkspacesLayoutComponent,
		MultiWorkspaceOnboardingComponent,
		WorkspaceSigninWithEmailComponent
	],
	providers: []
})
export class SignInWorkspacesLayoutModule {}
