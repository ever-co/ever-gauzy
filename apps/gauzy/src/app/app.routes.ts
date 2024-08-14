import { Routes } from '@angular/router';
import { AuthGuard } from '@gauzy/ui-core/core';
import { AppModuleGuard } from './app.module.guard';

/**
 * Routes for the application.
 */
export const routes: Routes = [
	{
		path: 'pages',
		loadChildren: () => import('./pages/pages.module').then((m) => m.PagesModule),
		canActivate: [AuthGuard, AppModuleGuard]
	},
	{
		path: 'onboarding',
		loadChildren: () => import('./onboarding/onboarding.module').then((m) => m.OnboardingModule),
		canActivate: [AuthGuard, AppModuleGuard]
	},
	{
		path: 'share',
		loadChildren: () => import('./share/share.module').then((m) => m.ShareModule),
		canActivate: []
	},
	{
		path: 'auth',
		loadChildren: () => import('./auth/auth.module').then((m) => m.NgxAuthModule),
		canActivate: []
	},
	{
		path: 'server-down',
		loadChildren: () => import('./server-down/server-down.module').then((m) => m.ServerDownModule)
	},
	{
		path: 'legal',
		loadChildren: () => import('./legal/legal.module').then((m) => m.LegalModule)
	},
	{
		path: 'sign-in',
		loadChildren: () => import('./auth/sign-in-success/sign-in-success.module').then((m) => m.SignInSuccessModule)
	},
	{
		path: '',
		redirectTo: 'pages',
		pathMatch: 'full'
	},
	{
		path: '**',
		redirectTo: 'pages',
		pathMatch: 'full'
	}
];
