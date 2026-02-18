import { NgModule } from '@angular/core';
import { ExtraOptions, RouterModule, Routes } from '@angular/router';
import { authConnectionGuard } from '@gauzy/desktop-ui-lib';

const routes: Routes = [
	{
		path: '',
		loadComponent: () => import('@gauzy/desktop-ui-lib').then((m) => m.TimeTrackerComponent)
	},
	{
		path: 'setup',
		loadComponent: () => import('@gauzy/desktop-ui-lib').then((m) => m.SetupComponent)
	},
	{
		path: 'time-tracker',
		canActivate: [authConnectionGuard],
		loadComponent: () => import('@gauzy/desktop-ui-lib').then((m) => m.TimeTrackerComponent),
		children: [
			{
				path: '',
				loadChildren: () => import('@gauzy/desktop-ui-lib').then((m) => m.RecapModule)
			}
		]
	},
	{
		path: 'screen-capture',
		loadComponent: () => import('@gauzy/desktop-ui-lib').then((m) => m.ScreenCaptureComponent)
	},
	{
		path: 'plugins',
		canActivate: [authConnectionGuard],
		children: [
			{
				path: '',
				loadChildren: () => import('@gauzy/desktop-ui-lib').then((m) => m.PluginRoutingModule)
			}
		]
	},
	{
		path: 'settings',
		loadComponent: () => import('@gauzy/desktop-ui-lib').then((m) => m.SettingsComponent)
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
		path: 'about',
		loadComponent: () => import('@gauzy/desktop-ui-lib').then((m) => m.AboutComponent)
	},
	{
		path: 'splash-screen',
		loadComponent: () => import('@gauzy/desktop-ui-lib').then((m) => m.SplashScreenComponent)
	},
	{
		path: 'always-on',
		loadComponent: () => import('@gauzy/desktop-ui-lib').then((m) => m.AlwaysOnComponent)
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
	exports: [RouterModule]
})
export class AppRoutingModule {}
