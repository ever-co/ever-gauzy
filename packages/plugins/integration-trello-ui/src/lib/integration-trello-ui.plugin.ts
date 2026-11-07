import { Routes } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { defineDeclarativePlugin, PluginRouteInput, PluginUiDefinition } from '@gauzy/plugin-ui';
import en from '../i18n/en.json';

/** The path under Integrations: equals the catalogue card's `redirectUrl` (`trello`), which opens it. */
export const TRELLO_PATH = 'trello';
export const TRELLO_LINK = `/pages/integrations/${TRELLO_PATH}`;

export const TRELLO_CHILD_ROUTES: Routes = [
	{
		path: '',
		loadComponent: () => import('./components/trello-page/trello-page.component').then((m) => m.TrelloPageComponent)
	},
	{
		path: ':integrationId',
		loadComponent: () => import('./components/settings/trello-settings.component').then((m) => m.TrelloSettingsComponent)
	}
];

export const TRELLO_ROUTE: PluginRouteInput = {
	location: 'integrations-sections',
	path: TRELLO_PATH,
	loadChildren: () => Promise.resolve(TRELLO_CHILD_ROUTES),
	data: {
		permissions: { only: [PermissionsEnum.INTEGRATION_VIEW], redirectTo: '/pages/integrations' },
		selectors: { project: false, team: false, employee: false, date: false, organization: true }
	}
};

/**
 * Integrations → Trello (`@gauzy/plugin-integration-trello-ui`): the connect page (Trello's authorize page,
 * which returns the token in the URL fragment; the page hands it to the API with the flow's state), and the
 * connection's settings (board ↔ project mappings with a list → status map, webhooks, imports, runs). Where the
 * API's Trello plugin is not loaded (`TRELLO_ENABLED` off) the page only says so.
 */
export const IntegrationTrelloUiPlugin: PluginUiDefinition = defineDeclarativePlugin('integration-trello', {
	version: '0.1.0',
	location: 'integrations-sections',
	routes: [TRELLO_ROUTE],
	permissionKeys: [PermissionsEnum.INTEGRATION_VIEW],
	translationNamespace: 'TRELLO',
	translations: { en }
});
