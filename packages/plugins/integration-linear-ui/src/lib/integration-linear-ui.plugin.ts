import { Routes } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { defineDeclarativePlugin, PluginRouteInput, PluginUiDefinition } from '@gauzy/plugin-ui';
import en from '../i18n/en.json';

/** The path under Integrations: equals the catalogue card's `redirectUrl` (`linear`), which opens it. */
export const LINEAR_PATH = 'linear';
export const LINEAR_LINK = `/pages/integrations/${LINEAR_PATH}`;

export const LINEAR_CHILD_ROUTES: Routes = [
	{
		path: '',
		loadComponent: () => import('./components/linear-page/linear-page.component').then((m) => m.LinearPageComponent)
	},
	{
		path: ':integrationId',
		loadComponent: () => import('./components/settings/linear-settings.component').then((m) => m.LinearSettingsComponent)
	}
];

export const LINEAR_ROUTE: PluginRouteInput = {
	location: 'integrations-sections',
	path: LINEAR_PATH,
	loadChildren: () => Promise.resolve(LINEAR_CHILD_ROUTES),
	data: {
		permissions: { only: [PermissionsEnum.INTEGRATION_VIEW], redirectTo: '/pages/integrations' },
		selectors: { project: false, team: false, employee: false, date: false, organization: true }
	}
};

/**
 * Integrations → Linear (`@gauzy/plugin-integration-linear-ui`): the connect page (OAuth through the API's
 * single-use state), and the connection's settings (team ↔ project mappings, imports, runs). Where the
 * API's Linear plugin is not loaded (`LINEAR_ENABLED` off) the page only says so.
 */
export const IntegrationLinearUiPlugin: PluginUiDefinition = defineDeclarativePlugin('integration-linear', {
	version: '0.1.0',
	location: 'integrations-sections',
	routes: [LINEAR_ROUTE],
	permissionKeys: [PermissionsEnum.INTEGRATION_VIEW],
	translationNamespace: 'LINEAR',
	translations: { en }
});
