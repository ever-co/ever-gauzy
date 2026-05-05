import { Routes } from '@angular/router';
import { PLUGIN_ROUTE_SELECTORS } from '../../plugin-route-selectors';

export const pluginMarketplaceRoutes: Routes = [
	{
		path: '',
		pathMatch: 'full',
		loadComponent: () => import('./plugin-marketplace.component').then((m) => m.PluginMarketplaceComponent)
	},
	{
		path: ':id/versions',
		data: { selectors: PLUGIN_ROUTE_SELECTORS },
		loadComponent: () =>
			import('./plugin-marketplace-item/version-history/version-history.component').then(
				(m) => m.VersionHistoryComponent
			)
	},
	{
		path: ':id',
		data: { selectors: PLUGIN_ROUTE_SELECTORS },
		loadComponent: () =>
			import('./plugin-marketplace-item/plugin-marketplace-item.component').then(
				(m) => m.PluginMarketplaceItemComponent
			),
		children: [
			{
				path: '',
				redirectTo: 'overview',
				pathMatch: 'full'
			},
			{
				path: 'overview',
				data: { selectors: PLUGIN_ROUTE_SELECTORS },
				loadComponent: () =>
					import('./plugin-marketplace-item/tabs/overview-tab/overview-tab.component').then(
						(m) => m.OverviewTabComponent
					)
			},
			{
				path: 'source-code',
				data: { selectors: PLUGIN_ROUTE_SELECTORS },
				loadComponent: () =>
					import('./plugin-marketplace-item/tabs/source-code-tab/source-code-tab.component').then(
						(m) => m.SourceCodeTabComponent
					)
			},
			{
				path: 'user-management',
				data: { selectors: PLUGIN_ROUTE_SELECTORS },
				loadComponent: () =>
					import('./plugin-marketplace-item/tabs/user-management-tab/user-management-tab.component').then(
						(m) => m.UserManagementTabComponent
					)
			},
			{
				path: 'settings',
				data: { selectors: PLUGIN_ROUTE_SELECTORS },
				loadComponent: () =>
					import('./plugin-marketplace-item/tabs/settings-tab/settings-tab.component').then(
						(m) => m.SettingsTabComponent
					)
			}
		]
	},
	{
		path: '**',
		redirectTo: ''
	}
];
