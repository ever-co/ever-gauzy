import { NgModule } from '@angular/core';
import { ExtraOptions, RouterModule, Routes } from '@angular/router';
import {
	AboutComponent,
	AgentDashboardComponent,
	AlwaysOnComponent,
	AuthConnectionGuard,
	ScreenCaptureComponent,
	ServerDownPage,
	SettingsComponent,
	SetupComponent,
	SplashScreenComponent,
	UpdaterComponent
} from '@gauzy/desktop-ui-lib';
import { AppModuleGuard } from './app.module.guards';

const routes: Routes = [
	{
		path: 'setup',
		component: SetupComponent
	},
	{
		path: 'auth',
		loadChildren: () => import('@gauzy/desktop-ui-lib').then((m) => m.authRoutes),
		canActivate: [AppModuleGuard]
	},
	{
		path: 'plugins',
		canActivate: [AuthConnectionGuard],
		loadComponent: () => import('@gauzy/desktop-ui-lib').then((m) => m.PluginLayoutComponent),
		loadChildren: () => import('@gauzy/desktop-ui-lib').then((m) => m.pluginRoutes)
	},
	{
		path: 'settings',
		component: SettingsComponent,
		loadChildren: () => import('@gauzy/desktop-ui-lib').then((m) => m.pluginRoutes)
	},
	{
		path: 'updater',
		component: UpdaterComponent
	},
	{
		path: 'splash-screen',
		component: SplashScreenComponent
	},
	{
		path: 'server-down',
		component: ServerDownPage
	},
	{
		path: 'always-on',
		component: AlwaysOnComponent
	},
	{
		path: 'about',
		component: AboutComponent
	},
	{
		path: 'server-dashboard',
		component: AgentDashboardComponent,
		loadChildren: () => import('@gauzy/desktop-ui-lib').then((m) => m.agentDashboardRoutes)
	},
	{
		path: 'screen-capture',
		component: ScreenCaptureComponent
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
