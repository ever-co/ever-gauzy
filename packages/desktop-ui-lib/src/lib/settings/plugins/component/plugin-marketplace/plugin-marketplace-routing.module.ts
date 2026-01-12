import { Routes } from '@angular/router';
import { PluginMarketplaceItemComponent } from './plugin-marketplace-item/plugin-marketplace-item.component';
import { OverviewTabComponent } from './plugin-marketplace-item/tabs/overview-tab/overview-tab.component';
import { SettingsTabComponent } from './plugin-marketplace-item/tabs/settings-tab/settings-tab.component';
import { SourceCodeTabComponent } from './plugin-marketplace-item/tabs/source-code-tab/source-code-tab.component';
import { UserManagementTabComponent } from './plugin-marketplace-item/tabs/user-management-tab/user-management-tab.component';
import { VersionHistoryComponent } from './plugin-marketplace-item/version-history/version-history.component';
import { PluginMarketplaceComponent } from './plugin-marketplace.component';

export const pluginMarketplaceRoutes: Routes = [
	{
		path: '',
		pathMatch: 'full',
		component: PluginMarketplaceComponent
	},
	{
		path: ':id/versions',
		component: VersionHistoryComponent
	},
	{
		path: ':id',
		component: PluginMarketplaceItemComponent,
		children: [
			{
				path: '',
				redirectTo: 'overview',
				pathMatch: 'full'
			},
			{
				path: 'overview',
				component: OverviewTabComponent
			},
			{
				path: 'source-code',
				component: SourceCodeTabComponent
			},
			{
				path: 'user-management',
				component: UserManagementTabComponent
			},
			{
				path: 'settings',
				component: SettingsTabComponent
			}
		]
	},
	{
		path: '**',
		redirectTo: ''
	}
];
