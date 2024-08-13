import { Route } from '@angular/router';
import { NbLogoutComponent } from '@nebular/auth';
import { NoAuthGuard, PageRouteService } from '@gauzy/ui-core/core';
import { AcceptInvitePage } from './accept-invite/accept-invite.component';
import { AcceptClientInvitePage } from './onboard-organization-client';
import { EstimateEmailComponent, EstimateEmailResolver } from './estimate-email';
import { NgxAuthComponent } from './components/auth/auth.component';
import { NgxLoginComponent } from './components/login/login.component';
import { NgxLoginWorkspaceComponent } from './components/login-workspace/login-workspace.component';
import { NgxLoginMagicComponent } from './components/login-magic/login-magic.component';
import { NgxMagicSignInWorkspaceComponent } from './components/magic-login-workspace/magic-login-workspace.component';
import { NgxForgotPasswordComponent } from './components/forgot-password/forgot-password.component';
import { NgxResetPasswordComponent } from './components/reset-password/reset-password.component';
import { ConfirmEmailComponent } from './components/confirm-email/confirm-email.component';
import { ConfirmEmailResolver } from './components/confirm-email/confirm-email.resolver';
import { NgxRegisterComponent } from './components/register/register.component';

/**
 * Creates routes for the auth module.
 *
 * @param _pageRouteService An instance of PageRouteService
 * @returns An array of Route objects
 */
export const createRoutes = (_pageRouteService: PageRouteService): Route[] => [
	{
		path: '',
		component: NgxAuthComponent,
		children: [
			{
				path: '',
				redirectTo: 'login',
				pathMatch: 'full'
			},
			{
				path: 'login',
				component: NgxLoginComponent,
				canActivate: [NoAuthGuard]
			},
			{
				path: 'register',
				component: NgxRegisterComponent,
				canActivate: [NoAuthGuard]
			},
			{
				path: 'login-workspace',
				component: NgxLoginWorkspaceComponent,
				canActivate: [NoAuthGuard]
			},
			{
				path: 'login-magic',
				component: NgxLoginMagicComponent,
				canActivate: [NoAuthGuard]
			},
			{
				path: 'magic-sign-in',
				component: NgxMagicSignInWorkspaceComponent,
				canActivate: [NoAuthGuard]
			},
			{
				path: 'request-password',
				component: NgxForgotPasswordComponent,
				canActivate: [NoAuthGuard]
			},
			{
				path: 'reset-password',
				component: NgxResetPasswordComponent,
				canActivate: [NoAuthGuard]
			},
			{
				path: 'confirm-email',
				component: ConfirmEmailComponent,
				canActivate: [NoAuthGuard],
				resolve: { resolver: ConfirmEmailResolver }
			},
			{
				path: 'accept-invite',
				component: AcceptInvitePage,
				canActivate: [NoAuthGuard]
			},
			{
				path: 'accept-client-invite',
				component: AcceptClientInvitePage,
				canActivate: [NoAuthGuard]
			},
			{
				path: 'estimate',
				component: EstimateEmailComponent,
				canActivate: [NoAuthGuard],
				resolve: { estimate: EstimateEmailResolver }
			},
			{
				path: 'logout',
				component: NbLogoutComponent
			}
		]
	}
];
