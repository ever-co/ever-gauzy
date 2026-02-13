import { NgModule } from '@angular/core';
import { ExtraOptions, NoPreloading, RouterModule, Routes } from '@angular/router';

import {
	AUTH_CONNECTION_GUARD_CONFIG,
	AuthConnectionGuard,
	AuthGuard,
	DEFAULT_AUTH_CONNECTION_GUARD_CONFIG,
	NoAuthGuard
} from '@gauzy/desktop-ui-lib';

const routes: Routes = [
	// Public routes (no authentication required)
	{
		path: 'setup',
		loadComponent: () => import('@gauzy/desktop-ui-lib').then((m) => m.SetupComponent)
	},
	{
		path: 'splash-screen',
		loadComponent: () => import('@gauzy/desktop-ui-lib').then((m) => m.SplashScreenComponent)
	},
	{
		path: 'server-down',
		loadComponent: () => import('@gauzy/desktop-ui-lib').then((m) => m.ServerDownPage)
	},
	{
		path: 'about',
		loadComponent: () => import('@gauzy/desktop-ui-lib').then((m) => m.AboutComponent)
	},
	{
		path: 'settings',
		loadComponent: () => import('@gauzy/desktop-ui-lib').then((m) => m.SettingsComponent)
	},

	// Auth routes (only for logged-out users)
	{
		path: 'auth',
		canActivate: [NoAuthGuard],
		loadChildren: () => import('@gauzy/desktop-ui-lib').then((m) => m.AuthModule)
	},

	// Protected routes (require authentication and connection)
	{
		path: 'time-tracker',
		canActivate: [AuthConnectionGuard, AuthGuard],
		loadComponent: () => import('@gauzy/desktop-ui-lib').then((m) => m.TimeTrackerComponent),
		children: [
			{
				path: '',
				loadChildren: () => import('@gauzy/desktop-ui-lib').then((m) => m.RecapModule)
			}
		]
	},
	{
		path: 'plugins',
		canActivate: [AuthConnectionGuard, AuthGuard],
		children: [
			{
				path: '',
				loadChildren: () => import('@gauzy/desktop-ui-lib').then((m) => m.PluginRoutingModule)
			}
		]
	},

	// Utility routes (require authentication but may work offline)
	{
		path: 'screen-capture',
		canActivate: [AuthGuard],
		loadComponent: () => import('@gauzy/desktop-ui-lib').then((m) => m.ScreenCaptureComponent)
	},
	{
		path: 'always-on',
		canActivate: [AuthGuard],
		loadComponent: () => import('@gauzy/desktop-ui-lib').then((m) => m.AlwaysOnComponent)
	},
	{
		path: 'updater',
		canActivate: [AuthGuard],
		loadComponent: () => import('@gauzy/desktop-ui-lib').then((m) => m.UpdaterComponent)
	},
	{
		path: 'viewer',
		canActivate: [AuthGuard],
		loadComponent: () => import('@gauzy/desktop-ui-lib').then((m) => m.ImageViewerComponent)
	},

	// Default route (protected)
	{
		path: '',
		canActivate: [AuthConnectionGuard, AuthGuard],
		loadComponent: () => import('@gauzy/desktop-ui-lib').then((m) => m.TimeTrackerComponent),
		children: [
			{
				path: '',
				loadChildren: () => import('@gauzy/desktop-ui-lib').then((m) => m.RecapModule)
			}
		]
	},

	// Wildcard - redirect to default
	{
		path: '**',
		redirectTo: ''
	}
];

/**
 * Configures the router for the application.
 * Uses NoPreloading strategy to minimize memory usage on app load.
 *
 * Guard execution order:
 * 1. AuthConnectionGuard - Checks server connection and basic auth state
 * 2. AuthGuard - Validates authentication tokens
 * 3. NoAuthGuard - Prevents authenticated users from accessing auth pages
 *
 * Note: AppModuleGuard is deprecated and replaced by AuthConnectionGuard
 */
const config: ExtraOptions = {
	useHash: true,
	preloadingStrategy: NoPreloading,
	initialNavigation: 'enabledBlocking',
	canceledNavigationResolution: 'replace'
};

@NgModule({
	imports: [RouterModule.forRoot(routes, config)],
	exports: [RouterModule],
	providers: [
		{
			provide: AUTH_CONNECTION_GUARD_CONFIG,
			useValue: DEFAULT_AUTH_CONNECTION_GUARD_CONFIG
		}
	]
})
export class AppRoutingModule {}
