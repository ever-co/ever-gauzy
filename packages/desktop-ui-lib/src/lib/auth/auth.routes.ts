import { Route } from '@angular/router';
import {
	NbAuthComponent,
	NbLogoutComponent,
	NbRegisterComponent,
	NbRequestPasswordComponent,
	NbResetPasswordComponent
} from '@nebular/auth';
import { NgxLoginComponent } from '../login';
import { NgxLoginMagicComponent } from '../login/features/login-magic/login-magic.component';
import { NgxLoginWorkspaceComponent } from '../login/features/login-workspace/login-workspace.component';
import { NgxMagicSignInWorkspaceComponent } from '../login/features/magic-login-workspace/magic-login-workspace.component';
import { NoAuthGuard } from './no-auth.guard';

export const authRoutes: Route[] = [
	{
		path: '',
		component: NbAuthComponent,
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
				component: NbRegisterComponent,
				canActivate: [NoAuthGuard]
			},
			{
				path: 'logout',
				component: NbLogoutComponent
			},
			{
				path: 'request-password',
				component: NbRequestPasswordComponent,
				canActivate: [NoAuthGuard]
			},
			{
				path: 'reset-password',
				component: NbResetPasswordComponent,
				canActivate: [NoAuthGuard]
			},
			{
				// Register the path 'login-workspace'
				path: 'login-workspace',
				// Register the component to load component: NgxLoginWorkspaceComponent,
				component: NgxLoginWorkspaceComponent,
				// Register the data object
				canActivate: [NoAuthGuard]
			},
			{
				// Register the path 'login-magic'
				path: 'login-magic',
				// Register the component to load component: NgxLoginMagicComponent,
				component: NgxLoginMagicComponent,
				// Register the data object
				canActivate: [NoAuthGuard]
			},
			{
				// Register the path 'magic-sign-in'
				path: 'magic-sign-in',
				// Register the component to load component: NgxMagicSignInWorkspaceComponent,
				component: NgxMagicSignInWorkspaceComponent,
				// Register the data object
				canActivate: [NoAuthGuard]
			}
		]
	}
];
