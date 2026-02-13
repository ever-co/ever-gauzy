import { NgModule } from '@angular/core';
import { ExtraOptions, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
	{
		path: '',
		loadComponent: () => import('@gauzy/desktop-ui-lib').then((m) => m.SetupComponent)
	},
	{
		path: 'setup',
		loadComponent: () => import('@gauzy/desktop-ui-lib').then((m) => m.SetupComponent)
	},
	{
		path: 'plugins',
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
		path: 'server-dashboard',
		loadComponent: () => import('@gauzy/desktop-ui-lib').then((m) => m.ServerDashboardComponent)
	},
	{
		path: 'about',
		loadComponent: () => import('@gauzy/desktop-ui-lib').then((m) => m.AboutComponent)
	},
	{
		path: 'splash-screen',
		loadComponent: () => import('@gauzy/desktop-ui-lib').then((m) => m.SplashScreenComponent)
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
