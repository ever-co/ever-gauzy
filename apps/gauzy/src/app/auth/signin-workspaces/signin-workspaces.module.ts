import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbButtonModule,
	NbIconModule,
	NbInputModule,
	NbLayoutModule,
	NbSpinnerModule
} from '@nebular/theme';
import { ThemeModule } from '../../@theme/theme.module';
import { ThemeSelectorModule } from '../../@theme/components/theme-sidebar/theme-settings/components/theme-selector/theme-selector.module';
import { PasswordFormFieldModule } from '../../@shared/user/forms/fields/password';
import { TranslateModule } from '../../@shared/translate/translate.module';
import { SignInWorkspacesLayoutComponent } from './signin-workspaces.component';
import { SignInWorkspacesLayoutRoutingModule } from './signin-workspaces-routing.module';
import { WorkspaceSigninWithEmailComponent } from './components/signin-with-email/signin-with-email.component';
import { SharedModule } from '../../@shared/shared.module';
import { MultiWorkspaceModule } from '../@shared/multi-workspace/multi-workspace.module';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbIconModule,
		NbInputModule,
		NbLayoutModule,
		NbSpinnerModule,
		SignInWorkspacesLayoutRoutingModule,
		ThemeModule,
		TranslateModule,
		ThemeSelectorModule,
		PasswordFormFieldModule,
		SharedModule,
		MultiWorkspaceModule
	],
	declarations: [
		SignInWorkspacesLayoutComponent,
		WorkspaceSigninWithEmailComponent
	],
	providers: []
})
export class SignInWorkspacesLayoutModule { }
