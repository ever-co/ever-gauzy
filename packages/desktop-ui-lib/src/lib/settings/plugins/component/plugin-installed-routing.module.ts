import { Routes } from '@angular/router';

export const pluginInstalledRoutes: Routes = [
	{
		path: '',
		pathMatch: 'full',
		loadComponent: () => import('./plugin-list/plugin-list.component').then((m) => m.PluginListComponent)
	},
	{
		path: ':name',
		loadComponent: () => import('./plugin/plugin.component').then((m) => m.PluginComponent)
	},
	{
		path: '**',
		redirectTo: ''
	}
];
