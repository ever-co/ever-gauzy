import { NgModule } from '@angular/core';
import { ExtraOptions, RouterModule, Routes } from '@angular/router';
import { AuthConnectionGuard, AuthGuard } from '@gauzy/desktop-ui-lib';
import { AppModuleGuard } from './app.module.guards';

const routes: Routes = [
	{
		path: 'setup',
		loadComponent: () => import('@gauzy/desktop-ui-lib').then((m) => m.SetupComponent)
	},
	{
		path: 'auth',
		canActivate: [AppModuleGuard],
		loadChildren: () => import('@gauzy/desktop-ui-lib').then((m) => m.AuthModule)
	},
	{
		path: 'plugins',
		canActivate: [AuthConnectionGuard],
		loadChildren: () => import('@gauzy/desktop-ui-lib').then((m) => m.PluginRoutingModule)
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
		path: 'splash-screen',
		loadComponent: () => import('@gauzy/desktop-ui-lib').then((m) => m.SplashScreenComponent)
	},
	{
		path: 'server-down',
		loadComponent: () => import('@gauzy/desktop-ui-lib').then((m) => m.ServerDownPage)
	},
	{
		path: 'always-on',
		loadComponent: () => import('@gauzy/desktop-ui-lib').then((m) => m.AlwaysOnComponent)
	},
	{
		path: 'about',
		loadComponent: () => import('@gauzy/desktop-ui-lib').then((m) => m.AboutComponent)
	},
	{
		path: 'server-dashboard',
		canActivate: [AppModuleGuard, AuthConnectionGuard, AuthGuard],
		loadComponent: () => import('@gauzy/desktop-ui-lib').then((m) => m.AgentDashboardComponent),
		loadChildren: () => import('@gauzy/desktop-ui-lib').then((m) => m.agentDashboardRoutes)
	},
	{
		path: 'screen-capture',
		loadComponent: () => import('@gauzy/desktop-ui-lib').then((m) => m.ScreenCaptureComponent)
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
