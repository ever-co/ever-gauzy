import { Routes } from '@angular/router';
import { AuthGuard, NoAuthGuard } from '@gauzy/ui-core/core';
import { AppModuleGuard } from './app.module.guard';

/**
 * Routes for the application.
 */
export const appRoutes: Routes = [
	{
		path: 'auth',
		loadChildren: () => import('@gauzy/ui-auth').then((m) => m.NgxAuthModule),
		canActivate: []
	},
	{
		path: 'onboarding',
		loadChildren: () => import('./onboarding/onboarding.module').then((m) => m.OnboardingModule),
		canActivate: [AuthGuard, AppModuleGuard]
	},
	{
		path: 'pages',
		loadChildren: () => import('./pages/pages.module').then((m) => m.PagesModule),
		canActivate: [AuthGuard, AppModuleGuard]
	},
	{
		path: 'share',
		loadChildren: () => import('./share/share.module').then((m) => m.ShareModule),
		canActivate: []
	},
	{
		path: 'server-down',
		loadChildren: () => import('./server-down/server-down.module').then((m) => m.ServerDownModule)
	},
	{
		path: 'legal',
		loadChildren: () => import('@gauzy/plugins/legal-ui').then((m) => m.LegalModule)
	},
	{
		path: 'sign-in',
		loadChildren: () => import('@gauzy/ui-auth').then((m) => m.SignInSuccessModule)
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
