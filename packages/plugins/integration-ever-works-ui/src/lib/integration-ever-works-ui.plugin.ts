import { Routes } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { defineDeclarativePlugin, PluginRouteInput } from '@gauzy/plugin-ui';
import en from '../i18n/en.json';

/** Path of the page, relative to `/pages/integrations` (the `redirectUrl` of the catalog row). */
export const EVER_WORKS_PATH = 'ever-works';

/** Absolute link of the page. */
export const EVER_WORKS_LINK = `/pages/integrations/${EVER_WORKS_PATH}`;

/** The page, also under `:integrationTenantId` (the list of connected integrations opens it that way). */
export const EVER_WORKS_CHILD_ROUTES: Routes = [
	{
		path: '',
		loadComponent: () =>
			import('./components/ever-works-page/ever-works-page.component').then((m) => m.EverWorksPageComponent)
	},
	{
		path: ':integrationTenantId',
		loadComponent: () =>
			import('./components/ever-works-page/ever-works-page.component').then((m) => m.EverWorksPageComponent)
	}
];

/** `/pages/integrations/ever-works`, for users who may see integrations. */
export const EVER_WORKS_ROUTE: PluginRouteInput = {
	location: 'integrations-sections',
	path: EVER_WORKS_PATH,
	loadChildren: () => Promise.resolve(EVER_WORKS_CHILD_ROUTES),
	data: {
		permissions: {
			only: [PermissionsEnum.INTEGRATION_VIEW],
			redirectTo: '/pages/integrations'
		},
		selectors: {
			project: false,
			team: false,
			employee: false,
			date: false,
			organization: true
		}
	}
};

/**
 * Ever Works UI plugin (`@gauzy/plugin-integration-ever-works-ui`): Integrations > Ever Works. The page
 * asks the API first; where the Ever Works plugin is not loaded (the default) it only says so.
 */
export const IntegrationEverWorksUiPlugin = defineDeclarativePlugin('integration-ever-works', {
	version: '0.1.0',
	location: 'integrations-sections',
	routes: [EVER_WORKS_ROUTE],
	permissionKeys: [PermissionsEnum.INTEGRATION_VIEW],
	translationNamespace: 'EVER_WORKS',
	translations: { en }
});
