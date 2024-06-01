import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbAuthModule } from '@nebular/auth';
import {
	NbAlertModule,
	NbButtonModule,
	NbCardModule,
	NbCheckboxModule,
	NbIconModule,
	NbInputModule,
	NbAccordionModule,
	NbFormFieldModule,
	NbSelectModule,
	NbLayoutModule,
	NbTooltipModule
} from '@nebular/theme';
import { NgxAuthRoutingModule } from './auth-routing.module';
import { NgxRegisterComponent } from './register/register.component';
import { NgxLoginComponent } from './login/login.component';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { NgxWhatsNewComponent } from './@shared/whats-new/whats-new.component';
import { NgxForgotPasswordComponent } from './forgot-password/forgot-password.component';
import { NgxRegisterSideFeaturesComponent } from './register/register-side-features/register-side-features.component';
import { NgxRegisterSideSingleFeatureComponent } from './register/register-side-features/register-side-single-feature/register-side-single-feature.component';
import { NgxAuthComponent } from './auth/auth.component';
import { ThemeModule } from '../@theme/theme.module';
import { ThemeSelectorModule } from '../@theme/components/theme-sidebar/theme-settings/components/theme-selector/theme-selector.module';
import { NgxResetPasswordComponent } from './reset-password/reset-password.component';
import { NgxFaqModule } from '../@shared/faq';
import { ConfirmEmailModule } from './confirm-email';
import { ElectronService } from '../@core/auth/electron.service';
import { SharedModule } from '../@shared/shared.module';
import { NgxLoginMagicComponent } from './login-magic/login-magic.component';
import { SocialLinksComponent } from './@shared/social-links/social-links.component';
import { WorkspaceSelectionModule } from './@shared/workspace-selection/workspace-selection.module';
import { NgxLoginWorkspaceComponent } from './login-workspace/login-workspace.component';
import { PasswordFormFieldModule } from '../@shared/user/forms/fields/password';
import { NgxMagicSignInWorkspaceComponent } from './magic-login-workspace/magic-login-workspace.component';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NgxAuthRoutingModule,
		NbAlertModule,
		NbInputModule,
		NbButtonModule,
		NbCheckboxModule,
		NbAuthModule,
		NbIconModule,
		NbCardModule,
		TranslateModule.forChild(),
		NbAccordionModule,
		NbFormFieldModule,
		NbSelectModule,
		NbLayoutModule,
		ThemeModule,
		ThemeSelectorModule,
		NgxFaqModule,
		ConfirmEmailModule,
		SharedModule,
		WorkspaceSelectionModule,
		PasswordFormFieldModule,
		NbTooltipModule
	],
	declarations: [
		NgxLoginComponent,
		NgxWhatsNewComponent,
		NgxForgotPasswordComponent,
		NgxRegisterSideFeaturesComponent,
		NgxRegisterSideSingleFeatureComponent,
		NgxAuthComponent,
		NgxRegisterComponent,
		NgxResetPasswordComponent,
		NgxLoginMagicComponent,
		NgxMagicSignInWorkspaceComponent,
		NgxLoginWorkspaceComponent,
		SocialLinksComponent
	],
	providers: [ElectronService]
})
export class NgxAuthModule {}
