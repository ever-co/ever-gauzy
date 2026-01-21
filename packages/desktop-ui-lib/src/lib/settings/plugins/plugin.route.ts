import { Routes } from '@angular/router';
import { pluginInstalledRoutes } from './component/plugin-installed-routing.module';
import { pluginMarketplaceRoutes } from './component/plugin-marketplace/plugin-marketplace-routing.module';
import { PendingInstallationResolver, PluginUploadResolver } from './services/resolvers';

export const routes: Routes = [
	{
		path: '',
		pathMatch: 'full',
		redirectTo: 'marketplace'
	},
	{
		path: 'marketplace',
		children: pluginMarketplaceRoutes,
		resolve: { isUploadAvailable: PluginUploadResolver, pendingCheck: PendingInstallationResolver }
	},
	{
		path: 'installed',
		children: pluginInstalledRoutes,
		resolve: { pendingCheck: PendingInstallationResolver }
	},
	{
		path: '**',
		redirectTo: ''
	}
];
