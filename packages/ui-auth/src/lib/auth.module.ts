import { Inject, NgModule } from '@angular/core';
import { ROUTES, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { NbAuthModule } from '@nebular/auth';
import {
	NbAccordionModule,
	NbAlertModule,
	NbButtonModule,
	NbCardModule,
	NbCheckboxModule,
	NbDialogModule,
	NbFormFieldModule,
	NbIconModule,
	NbInputModule,
	NbLayoutModule,
	NbListModule,
	NbSelectModule,
	NbSpinnerModule,
	NbTooltipModule
} from '@nebular/theme';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import {
	ElectronService,
	InviteService,
	NoAuthGuard,
	PageRouteRegistryService,
	RoleService
} from '@gauzy/ui-core/core';
import { ThemeModule, ThemeSelectorModule } from '@gauzy/ui-core/theme';
import { NgxFaqModule, PasswordFormFieldModule, SharedModule, getBrowserLanguage } from '@gauzy/ui-core/shared';
import { HttpLoaderFactory } from '@gauzy/ui-core/i18n';
import { createAuthRoutes } from './auth.routes';
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
import { AcceptInviteComponent } from './components/accept-invite/accept-invite.component';
import { AcceptInviteFormComponent } from './components/accept-invite/accept-invite-form/accept-invite-form.component';
import { AcceptClientInviteComponent } from './components/accept-client-invite/accept-client-invite.component';
import { AcceptClientInviteFormComponent } from './components/accept-client-invite/accept-client-invite-form/accept-client-invite-form.component';
import { EstimateEmailComponent } from './components/estimate-email/estimate-email.component';

// Nebular Modules
const NB_MODULES = [
	NbAccordionModule,
	NbAlertModule,
	NbAuthModule,
	NbButtonModule,
	NbCardModule,
	NbCheckboxModule,
	NbDialogModule.forChild(),
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
	AcceptClientInviteComponent,
	AcceptClientInviteFormComponent,
	AcceptInviteComponent,
	AcceptInviteFormComponent,
	ConfirmEmailComponent,
	EstimateEmailComponent,
	NgxAuthComponent,
	NgxForgotPasswordComponent,
	NgxLoginComponent,
	NgxLoginMagicComponent,
	NgxLoginWorkspaceComponent,
	NgxMagicSignInWorkspaceComponent,
	NgxRegisterComponent,
	NgxRegisterSideFeaturesComponent,
	NgxRegisterSideSingleFeatureComponent,
	NgxResetPasswordComponent,
	NgxWhatsNewComponent,
	SocialLinksComponent,
	WorkspaceSelectionComponent
];

const THIRD_PARTY_MODULES = [
	TranslateModule.forRoot({
		defaultLanguage: getBrowserLanguage(), // Get the browser language and fall back to a default if needed
		loader: {
			provide: TranslateLoader,
			useFactory: HttpLoaderFactory,
			deps: [HttpClient]
		}
	})
];

@NgModule({
	imports: [
		RouterModule.forChild([]),
		...NB_MODULES,
		...THIRD_PARTY_MODULES,
		ThemeSelectorModule,
		NgxFaqModule,
		ThemeModule,
		SharedModule,
		PasswordFormFieldModule
	],
	declarations: [...COMPONENTS],
	providers: [
		ElectronService,
		{
			provide: ROUTES,
			useFactory: (pageRouteRegistryService: PageRouteRegistryService) =>
				createAuthRoutes(pageRouteRegistryService),
			deps: [PageRouteRegistryService],
			multi: true
		},
		InviteService,
		RoleService
	]
})
export class NgxAuthModule {
	private static hasRegisteredPageRoutes = false; // Flag to check if routes have been registered

	constructor(@Inject(PageRouteRegistryService) readonly _pageRouteRegistryService: PageRouteRegistryService) {
		// Register the routes
		this.registerPageRoutes();
	}

	/**
	 * Registers routes for the auth module.
	 * Ensures that routes are registered only once.
	 *
	 * @returns {void}
	 */
	registerPageRoutes(): void {
		if (NgxAuthModule.hasRegisteredPageRoutes) {
			return;
		}

		// Register the login workspace route
		this._pageRouteRegistryService.registerPageRoutes([
			{
				// Register the location 'auth'
				location: 'auth',
				// Register the path 'login-workspace'
				path: 'login-workspace',
				// Register the component to load component: NgxLoginWorkspaceComponent,
				component: NgxLoginWorkspaceComponent,
				// Register the data object
				canActivate: [NoAuthGuard]
			},
			{
				// Register the location 'auth'
				location: 'auth',
				// Register the path 'login-magic'
				path: 'login-magic',
				// Register the component to load component: NgxLoginMagicComponent,
				component: NgxLoginMagicComponent,
				// Register the data object
				canActivate: [NoAuthGuard]
			},
			{
				// Register the location 'auth'
				location: 'auth',
				// Register the path 'magic-sign-in'
				path: 'magic-sign-in',
				// Register the component to load component: NgxMagicSignInWorkspaceComponent,
				component: NgxMagicSignInWorkspaceComponent,
				// Register the data object
				canActivate: [NoAuthGuard]
			}
		]);

		// Set hasRegisteredRoutes to true
		NgxAuthModule.hasRegisteredPageRoutes = true;
	}
}
