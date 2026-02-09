import { Route } from '@angular/router';
import {
	NbAuthComponent,
	NbLogoutComponent,
	NbRegisterComponent,
	NbRequestPasswordComponent,
	NbResetPasswordComponent
} from '@nebular/auth';




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
				loadComponent: () => import('../login').then(m => m.NgxLoginComponent),
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
				loadComponent: () => import('../login/features/login-workspace/login-workspace.component').then(m => m.NgxLoginWorkspaceComponent),
				// Register the data object
				canActivate: [NoAuthGuard]
			},
			{
				// Register the path 'login-magic'
				path: 'login-magic',
				// Register the component to load component: NgxLoginMagicComponent,
				loadComponent: () => import('../login/features/login-magic/login-magic.component').then(m => m.NgxLoginMagicComponent),
				// Register the data object
				canActivate: [NoAuthGuard]
			},
			{
				// Register the path 'magic-sign-in'
				path: 'magic-sign-in',
				// Register the component to load component: NgxMagicSignInWorkspaceComponent,
				loadComponent: () => import('../login/features/magic-login-workspace/magic-login-workspace.component').then(m => m.NgxMagicSignInWorkspaceComponent),
				// Register the data object
				canActivate: [NoAuthGuard]
			}
		]
	}
];
