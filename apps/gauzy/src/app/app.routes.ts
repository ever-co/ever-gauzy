import { Routes } from '@angular/router';
import { AuthGuard } from '@gauzy/ui-core/core';
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
		path: 'sign-in',
		loadChildren: () => import('@gauzy/ui-auth').then((m) => m.SignInSuccessModule)
	},
	{
		path: 'onboarding',
		loadChildren: () => import('@gauzy/plugin-onboarding-ui').then((m) => m.OnboardingModule),
		canActivate: [AuthGuard, AppModuleGuard]
	},
	{
		path: 'pages',
		loadChildren: () => import('./pages/pages.module').then((m) => m.PagesModule),
		canActivate: [AuthGuard, AppModuleGuard]
	},
	{
		path: 'share',
		loadChildren: () => import('@gauzy/plugin-public-layout-ui').then((m) => m.PublicLayoutModule),
		canActivate: []
	},
	{
		path: 'legal',
		loadChildren: () => import('@gauzy/plugin-legal-ui').then((m) => m.LegalModule)
	},
	{
		path: 'server-down',
		loadChildren: () => import('./server-down/server-down.module').then((m) => m.ServerDownModule)
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
