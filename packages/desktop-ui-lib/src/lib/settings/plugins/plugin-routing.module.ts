import { Routes } from '@angular/router';

export const pluginRoutes: Routes = [
	{
		path: '',
		pathMatch: 'full',
		redirectTo: 'plugins'
	},
	{
		path: 'marketplace-plugins',
		loadComponent: () =>
			import('./component/plugin-marketplace/plugin-marketplace.component').then(
				(m) => m.PluginMarketplaceComponent
			)
	},
	{
		path: 'plugins',
		loadComponent: () => import('./component/plugin-list/plugin-list.component').then((m) => m.PluginListComponent)
	},
	{
		path: 'marketplace-plugins/:id',
		loadComponent: () => import('./component/plugin/plugin.component').then((m) => m.PluginComponent)
	},
	{
		path: 'plugins/:name',
		loadComponent: () => import('./component/plugin/plugin.component').then((m) => m.PluginComponent)
	},
	{
		path: '**',
		redirectTo: 'plugins'
	}
];
