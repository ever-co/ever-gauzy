import { Routes } from '@angular/router';
import { PluginUploadResolver } from './services/resolvers';

export const routes: Routes = [
	{
		path: '',
		pathMatch: 'full',
		redirectTo: 'marketplace'
	},
	{
		path: 'marketplace',
		loadChildren: () => import('./component/plugin-marketplace/plugin-marketplace-routing.module').then(m => m.pluginMarketplaceRoutes),
		resolve: { isUploadAvailable: PluginUploadResolver }
	},
	{
		path: 'installed',
		loadChildren: () => import('./component/plugin-installed-routing.module').then(m => m.pluginInstalledRoutes)
	},
	{
		path: '**',
		redirectTo: ''
	}
];
