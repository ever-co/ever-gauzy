import { Route } from '@angular/router';
import {
	NbAuthComponent,
	NbLogoutComponent,
	NbRegisterComponent,
	NbRequestPasswordComponent,
	NbResetPasswordComponent
} from '@nebular/auth';

import { noAuthGuard } from './no-auth.guard';

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
				loadComponent: () => import('../login').then((m) => m.NgxLoginComponent),
				canActivate: [noAuthGuard]
			},
			{
				path: 'register',
				component: NbRegisterComponent,
				canActivate: [noAuthGuard]
			},
			{
				path: 'logout',
				component: NbLogoutComponent
			},
			{
				path: 'request-password',
				component: NbRequestPasswordComponent,
				canActivate: [noAuthGuard]
			},
			{
				path: 'reset-password',
				component: NbResetPasswordComponent,
				canActivate: [noAuthGuard]
			},
			{
				// Register the path 'login-workspace'
				path: 'login-workspace',
				// Register the component to load component: NgxLoginWorkspaceComponent,
				loadComponent: () =>
					import('../login/features/login-workspace/login-workspace.component').then(
						(m) => m.NgxLoginWorkspaceComponent
					),
				// Register the data object
				canActivate: [noAuthGuard]
			},
			{
				// Register the path 'login-magic'
				path: 'login-magic',
				// Register the component to load component: NgxLoginMagicComponent,
				loadComponent: () =>
					import('../login/features/login-magic/login-magic.component').then((m) => m.NgxLoginMagicComponent),
				// Register the data object
				canActivate: [noAuthGuard]
			},
			{
				// Register the path 'magic-sign-in'
				path: 'magic-sign-in',
				// Register the component to load component: NgxMagicSignInWorkspaceComponent,
				loadComponent: () =>
					import('../login/features/magic-login-workspace/magic-login-workspace.component').then(
						(m) => m.NgxMagicSignInWorkspaceComponent
					),
				// Register the data object
				canActivate: [noAuthGuard]
			}
		]
	}
];
