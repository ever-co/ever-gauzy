import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbAuthModule } from '@nebular/auth';
import {
	NbAccordionModule,
	NbAlertModule,
	NbButtonModule,
	NbCardModule,
	NbCheckboxModule,
	NbFormFieldModule,
	NbIconModule,
	NbInputModule,
	NbLayoutModule,
	NbSelectModule,
	NbTooltipModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { ElectronService } from '@gauzy/ui-core/core';
import { ThemeModule, ThemeSelectorModule } from '@gauzy/ui-core/theme';
import { NgxFaqModule, PasswordFormFieldModule, SharedModule } from '@gauzy/ui-core/shared';
import { NgxAuthRoutingModule } from './auth-routing.module';
import { NgxRegisterComponent } from './register/register.component';
import { NgxLoginComponent } from './login/login.component';
import { NgxWhatsNewComponent } from './@shared/whats-new/whats-new.component';
import { NgxForgotPasswordComponent } from './forgot-password/forgot-password.component';
import { NgxRegisterSideFeaturesComponent } from './register/register-side-features/register-side-features.component';
import { NgxRegisterSideSingleFeatureComponent } from './register/register-side-features/register-side-single-feature/register-side-single-feature.component';
import { NgxAuthComponent } from './auth/auth.component';
import { NgxResetPasswordComponent } from './reset-password/reset-password.component';
import { ConfirmEmailModule } from './confirm-email';
import { NgxLoginMagicComponent } from './login-magic/login-magic.component';
import { SocialLinksComponent } from './@shared/social-links/social-links.component';
import { WorkspaceSelectionModule } from './@shared/workspace-selection/workspace-selection.module';
import { NgxLoginWorkspaceComponent } from './login-workspace/login-workspace.component';
import { NgxMagicSignInWorkspaceComponent } from './magic-login-workspace/magic-login-workspace.component';
import { EstimateEmailModule } from './estimate-email/estimate-email.module';

const NB_MODULES = [
	NbAccordionModule,
	NbAlertModule,
	NbAuthModule,
	NbButtonModule,
	NbCardModule,
	NbCheckboxModule,
	NbFormFieldModule,
	NbIconModule,
	NbInputModule,
	NbLayoutModule,
	NbSelectModule,
	NbTooltipModule
];

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		...NB_MODULES,
		NgxAuthRoutingModule,
		TranslateModule.forChild(),
		ThemeSelectorModule,
		NgxFaqModule,
		EstimateEmailModule,
		ConfirmEmailModule,
		ThemeModule,
		SharedModule,
		WorkspaceSelectionModule,
		PasswordFormFieldModule
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
