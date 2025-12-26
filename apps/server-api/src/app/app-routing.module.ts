import { NgModule } from '@angular/core';
import { ExtraOptions, RouterModule, Routes } from '@angular/router';
import {
	AboutComponent,
	AuthConnectionGuard,
	ServerDashboardComponent,
	SettingsComponent,
	SetupComponent,
	SplashScreenComponent,
	UpdaterComponent
} from '@gauzy/desktop-ui-lib';

const routes: Routes = [
	{
		path: '',
		component: SetupComponent
	},
	{
		path: 'setup',
		component: SetupComponent
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
		path: 'server-dashboard',
		component: ServerDashboardComponent
	},
	{
		path: 'about',
		component: AboutComponent
	},
	{
		path: 'splash-screen',
		component: SplashScreenComponent
	}
];

const config: ExtraOptions = {
	useHash: true
};

@NgModule({
	imports: [RouterModule.forRoot(routes, config)],
	exports: [RouterModule]
})
export class AppRoutingModule {}
