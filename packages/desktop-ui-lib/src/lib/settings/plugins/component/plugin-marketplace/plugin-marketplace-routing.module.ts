import { Routes } from '@angular/router';

export const pluginMarketplaceRoutes: Routes = [
	{
		path: '',
		pathMatch: 'full',
		loadComponent: () => import('./plugin-marketplace.component').then((m) => m.PluginMarketplaceComponent)
	},
	{
		path: ':id/versions',
		loadComponent: () =>
			import('./plugin-marketplace-item/version-history/version-history.component').then(
				(m) => m.VersionHistoryComponent
			)
	},
	{
		path: ':id',
		loadComponent: () =>
			import('./plugin-marketplace-item/plugin-marketplace-item.component').then(
				(m) => m.PluginMarketplaceItemComponent
			)
	},
	{
		path: '**',
		redirectTo: ''
	}
];
