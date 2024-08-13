import { NgModule } from '@angular/core';
import { ROUTES, RouterModule } from '@angular/router';
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
	NbListModule,
	NbSelectModule,
	NbSpinnerModule,
	NbTooltipModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { ElectronService, PageRouteService } from '@gauzy/ui-core/core';
import { ThemeModule, ThemeSelectorModule } from '@gauzy/ui-core/theme';
import { NgxFaqModule, PasswordFormFieldModule, SharedModule } from '@gauzy/ui-core/shared';
import { createRoutes } from './auth.routes';
import { EstimateEmailModule } from './estimate-email/estimate-email.module';
import { WorkspaceSelectionComponent } from './components/workspace-selection/workspace-selection.component';
import { SocialLinksComponent } from './components/social-links/social-links.component';
import { NgxLoginWorkspaceComponent } from './components/login-workspace/login-workspace.component';
import { NgxLoginMagicComponent } from './components/login-magic/login-magic.component';
import { NgxMagicSignInWorkspaceComponent } from './components/magic-login-workspace/magic-login-workspace.component';
import { NgxResetPasswordComponent } from './components/reset-password/reset-password.component';
import { NgxRegisterComponent } from './components/register/register.component';
import { NgxAuthComponent } from './components/auth/auth.component';
import { NgxRegisterSideSingleFeatureComponent } from './components/register/register-side-features/register-side-single-feature/register-side-single-feature.component';
import { NgxRegisterSideFeaturesComponent } from './components/register/register-side-features/register-side-features.component';
import { NgxForgotPasswordComponent } from './components/forgot-password/forgot-password.component';
import { NgxWhatsNewComponent } from './components/whats-new/whats-new.component';
import { NgxLoginComponent } from './components/login/login.component';
import { ConfirmEmailComponent } from './components/confirm-email/confirm-email.component';

// Nebular Modules
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
	NbListModule,
	NbSelectModule,
	NbSpinnerModule,
	NbTooltipModule
];

// Components
const COMPONENTS = [
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
	SocialLinksComponent,
	WorkspaceSelectionComponent,
	ConfirmEmailComponent
];

@NgModule({
	imports: [
		...NB_MODULES,
		RouterModule.forChild([]),
		TranslateModule.forChild(),
		ThemeSelectorModule,
		NgxFaqModule,
		EstimateEmailModule,
		ThemeModule,
		SharedModule,
		PasswordFormFieldModule
	],
	exports: [RouterModule],
	declarations: [...COMPONENTS],
	providers: [
		ElectronService,
		{
			provide: ROUTES,
			useFactory: (pageRouteService: PageRouteService) => createRoutes(pageRouteService),
			deps: [PageRouteService],
			multi: true
		}
	]
})
export class NgxAuthModule {}
