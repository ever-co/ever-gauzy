import { Routes } from '@angular/router';
import { PluginUploadResolver } from '@gauzy/desktop-ui-lib';

/**
 * Web-app-specific plugin routes.
 * These extend the base plugin routes (from desktop-ui-lib) with the web-only "Built-in" tab.
 * Used in place of the generic PluginRoutingModule so that the Built-in route and its
 * component can live in the web app (where IntegrationsStoreService is available).
 */
export const webPluginRoutes: Routes = [
	{
		path: '',
		loadComponent: () => import('@gauzy/desktop-ui-lib').then((m) => m.PluginLayoutComponent),
		children: [
			{
				path: '',
				pathMatch: 'full',
				redirectTo: 'built-in'
			},
			{
				path: 'built-in',
				title: 'Built In',
				loadComponent: () =>
					import('./components/plugin-builtin/plugin-builtin.component').then(
						(m) => m.PluginBuiltinComponent
					),
				data: {
					selectors: {
						date: false,
						employee: false,
						project: false,
						team: false,
						datePicker: false
					}
				},
			},
			{
				title: 'Marketplace',
				path: 'marketplace',
				data: {
					selectors: {
						date: false,
						employee: false,
						project: false,
						team: false,
						datePicker: false
					}
				},
				loadChildren: () => import('@gauzy/desktop-ui-lib').then((m) => m.pluginMarketplaceRoutes),
				resolve: { isUploadAvailable: PluginUploadResolver }
			},
			{
				path: '**',
				redirectTo: ''
			}
		]
	}
];
