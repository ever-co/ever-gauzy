import { Routes } from '@angular/router';
import { PluginUploadResolver } from './services/resolvers/plugin-upload.resolver';

export const pluginRoutes: Routes = [
	{
		path: '',
		pathMatch: 'full',
		redirectTo: 'plugins'
	},
	{
		path: 'marketplace-plugins',
		resolve: {
			isUploadAvailable: PluginUploadResolver
		},
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
		loadComponent: () =>
			import('./component/plugin-marketplace/plugin-marketplace-item/plugin-marketplace-item.component').then(
				(m) => m.PluginMarketplaceItemComponent
			)
	},
	{
		path: 'marketplace-plugins/:id/versions',
		loadComponent: () =>
			import(
				'./component/plugin-marketplace/plugin-marketplace-item/version-history/version-history.component'
			).then((m) => m.VersionHistoryComponent)
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
