import { Routes } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { defineDeclarativePlugin, PluginRouteInput, PluginUiDefinition } from '@gauzy/plugin-ui';
import en from '../i18n/en.json';

/** The path under Integrations: equals the catalogue card's `redirectUrl` (`asana`), which opens it. */
export const ASANA_PATH = 'asana';
export const ASANA_LINK = `/pages/integrations/${ASANA_PATH}`;

export const ASANA_CHILD_ROUTES: Routes = [
	{
		path: '',
		loadComponent: () => import('./components/asana-page/asana-page.component').then((m) => m.AsanaPageComponent)
	},
	{
		path: ':integrationId',
		loadComponent: () => import('./components/settings/asana-settings.component').then((m) => m.AsanaSettingsComponent)
	}
];

export const ASANA_ROUTE: PluginRouteInput = {
	location: 'integrations-sections',
	path: ASANA_PATH,
	loadChildren: () => Promise.resolve(ASANA_CHILD_ROUTES),
	data: {
		permissions: { only: [PermissionsEnum.INTEGRATION_VIEW], redirectTo: '/pages/integrations' },
		selectors: { project: false, team: false, employee: false, date: false, organization: true }
	}
};

/**
 * Integrations → Asana (`@gauzy/plugin-integration-asana-ui`): the connect page (OAuth through the API's
 * single-use state), and the connection's settings (Asana project ↔ project mappings with a section → status
 * map, webhooks, imports, runs). Where the API's Asana plugin is not loaded (`ASANA_ENABLED` off) the page
 * only says so.
 */
export const IntegrationAsanaUiPlugin: PluginUiDefinition = defineDeclarativePlugin('integration-asana', {
	version: '0.1.0',
	location: 'integrations-sections',
	routes: [ASANA_ROUTE],
	permissionKeys: [PermissionsEnum.INTEGRATION_VIEW],
	translationNamespace: 'ASANA',
	translations: { en }
});
