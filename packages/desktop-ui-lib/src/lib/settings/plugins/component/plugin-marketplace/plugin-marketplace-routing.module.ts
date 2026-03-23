import { Routes } from '@angular/router';

const selectors = {
	date: false,
	employee: false,
	project: false,
	team: false,
	datePicker: false
};

export const pluginMarketplaceRoutes: Routes = [
	{
		path: '',
		pathMatch: 'full',
		loadComponent: () => import('./plugin-marketplace.component').then((m) => m.PluginMarketplaceComponent)
	},
	{
		path: ':id/versions',
		data: { selectors },
		loadComponent: () =>
			import('./plugin-marketplace-item/version-history/version-history.component').then(
				(m) => m.VersionHistoryComponent
			)
	},
	{
		path: ':id',
		data: { selectors },
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
				loadComponent: () =>
					import('./plugin-marketplace-item/tabs/overview-tab/overview-tab.component').then(
						(m) => m.OverviewTabComponent
					)
			},
			{
				path: 'source-code',
				loadComponent: () =>
					import('./plugin-marketplace-item/tabs/source-code-tab/source-code-tab.component').then(
						(m) => m.SourceCodeTabComponent
					)
			},
			{
				path: 'user-management',
				loadComponent: () =>
					import('./plugin-marketplace-item/tabs/user-management-tab/user-management-tab.component').then(
						(m) => m.UserManagementTabComponent
					)
			},
			{
				path: 'settings',
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
