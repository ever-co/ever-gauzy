import { NgModule } from '@angular/core';
import { ExtraOptions, RouterModule, Routes } from '@angular/router';

import {
	AUTH_CONNECTION_GUARD_CONFIG,
	AuthConnectionGuard,
	AuthGuard,
	DEFAULT_AUTH_CONNECTION_GUARD_CONFIG
} from '@gauzy/desktop-ui-lib';
import { AppModuleGuard } from './app.module.guards';

const routes: Routes = [
	{
		path: 'setup',
		loadComponent: () => import('@gauzy/desktop-ui-lib').then((m) => m.SetupComponent)
	},
	{
		path: 'auth',
		canActivate: [AppModuleGuard, AuthConnectionGuard],
		loadChildren: () => import('@gauzy/desktop-ui-lib').then((m) => m.AuthModule)
	},
	{
		path: 'time-tracker',
		canActivate: [AppModuleGuard, AuthGuard, AuthConnectionGuard],
		loadComponent: () => import('@gauzy/desktop-ui-lib').then((m) => m.TimeTrackerComponent),
		loadChildren: () => import('@gauzy/desktop-ui-lib').then((m) => m.RecapModule)
	},
	{
		path: 'screen-capture',
		loadComponent: () => import('@gauzy/desktop-ui-lib').then((m) => m.ScreenCaptureComponent)
	},
	{
		path: 'always-on',
		loadComponent: () => import('@gauzy/desktop-ui-lib').then((m) => m.AlwaysOnComponent)
	},
	{
		path: 'settings',
		loadComponent: () => import('@gauzy/desktop-ui-lib').then((m) => m.SettingsComponent)
	},
	{
		path: 'plugins',
		canActivate: [AuthConnectionGuard],
		loadChildren: () => import('@gauzy/desktop-ui-lib').then((m) => m.PluginRoutingModule)
	},
	{
		path: 'updater',
		loadComponent: () => import('@gauzy/desktop-ui-lib').then((m) => m.UpdaterComponent)
	},
	{
		path: 'viewer',
		loadComponent: () => import('@gauzy/desktop-ui-lib').then((m) => m.ImageViewerComponent)
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
		path: '',
		canActivate: [AppModuleGuard, AuthGuard, AuthConnectionGuard],
		loadComponent: () => import('@gauzy/desktop-ui-lib').then((m) => m.TimeTrackerComponent),
		loadChildren: () => import('@gauzy/desktop-ui-lib').then((m) => m.RecapModule)
	},
	{
		path: 'about',
		loadComponent: () => import('@gauzy/desktop-ui-lib').then((m) => m.AboutComponent)
	}
];

/**
 * Configures the router for the application.
 */
const config: ExtraOptions = {
	useHash: true
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
