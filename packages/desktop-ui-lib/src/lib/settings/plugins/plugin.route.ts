import { Routes } from '@angular/router';
import { pluginInstalledRoutes } from './component/plugin-installed-routing.module';
import { pluginMarketplaceRoutes } from './component/plugin-marketplace/plugin-marketplace-routing.module';
import { PluginUploadResolver } from './services/resolvers/plugin-upload.resolver';

export const routes: Routes = [
	{
		path: '',
		pathMatch: 'full',
		redirectTo: 'marketplace'
	},
	{
		path: 'marketplace',
		children: pluginMarketplaceRoutes,
		resolve: { isUploadAvailable: PluginUploadResolver }
	},
	{
		path: 'installed',
		children: pluginInstalledRoutes
	},
	{
		path: '**',
		redirectTo: ''
	}
];
