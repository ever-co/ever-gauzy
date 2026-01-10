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
			),
		children: [
			{
				path: '',
				redirectTo: 'overview',
				pathMatch: 'full'
			},
			{
				path: 'overview',
				loadChildren: () =>
					import('./plugin-marketplace-item/tabs/overview-tab/overview-tab.module').then(
						(m) => m.OverviewTabModule
					)
			},
			{
				path: 'source-code',
				loadChildren: () =>
					import('./plugin-marketplace-item/tabs/source-code-tab/source-code-tab.module').then(
						(m) => m.SourceCodeTabModule
					)
			},
			{
				path: 'user-management',
				loadChildren: () =>
					import('./plugin-marketplace-item/tabs/user-management-tab/user-management-tab.module').then(
						(m) => m.UserManagementTabModule
					)
			},
			{
				path: 'settings',
				loadChildren: () =>
					import('./plugin-marketplace-item/tabs/settings-tab/settings-tab.module').then(
						(m) => m.SettingsTabModule
					)
			}
		]
	},
	{
		path: '**',
		redirectTo: ''
	}
];
