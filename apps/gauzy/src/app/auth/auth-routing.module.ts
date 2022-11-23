import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { NgxLoginComponent } from './login/login.component';
import { NgxRegisterComponent } from './register/register.component';
import { NgxAuthComponent } from "./auth/auth.component";
import { NgxForgotPasswordComponent } from "./forgot-password/forgot-password.component";
import { NoAuthGuard } from '../@core/auth/no-auth.guard';
import { NbLogoutComponent } from '@nebular/auth';
import { AcceptInvitePage } from './accept-invite/accept-invite.component';
import { AcceptClientInvitePage } from './onboard-organization-client';
import { EstimateEmailComponent, EstimateEmailResolver } from './estimate-email';
import { NgxResetPasswordComponent } from "./reset-password/reset-password.component";
import { ConfirmEmailComponent } from './confirm-email';
import { ConfirmEmailResolver } from './confirm-email/confirm-email.resolver';

export const routes: Routes = [
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
				path: 'logout',
				component: NbLogoutComponent
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
				resolve: {
					resolver: ConfirmEmailResolver
				}
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
				resolve: {
					estimate: EstimateEmailResolver
				},
			}
		],
	},
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule],
})
export class NgxAuthRoutingModule {}
