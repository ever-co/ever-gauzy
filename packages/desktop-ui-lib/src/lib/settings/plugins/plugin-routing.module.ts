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
		loadChildren: () =>
			import('./component/plugin-marketplace/plugin-marketplace-routing.module').then(
				(m) => m.pluginMarketplaceRoutes
			),
		resolve: { isUploadAvailable: PluginUploadResolver }
	},
	{
		path: 'plugins',
		loadChildren: () => import('./component/plugin-installed-routing.module').then((m) => m.pluginInstalledRoutes)
	},
	{
		path: '**',
		redirectTo: 'plugins'
	}
];
