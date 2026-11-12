import { Routes } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { defineDeclarativePlugin, PluginRouteInput, PluginUiDefinition } from '@gauzy/plugin-ui';
import en from '../i18n/en.json';

/** The path under Integrations: equals the catalogue card's `redirectUrl` (`jira`), which opens it. */
export const JIRA_PATH = 'jira';
export const JIRA_LINK = `/pages/integrations/${JIRA_PATH}`;

export const JIRA_CHILD_ROUTES: Routes = [
	{
		path: '',
		loadComponent: () => import('./components/jira-page/jira-page.component').then((m) => m.JiraPageComponent)
	},
	{
		path: ':integrationId',
		loadComponent: () => import('./components/settings/jira-settings.component').then((m) => m.JiraSettingsComponent)
	}
];

export const JIRA_ROUTE: PluginRouteInput = {
	location: 'integrations-sections',
	path: JIRA_PATH,
	loadChildren: () => Promise.resolve(JIRA_CHILD_ROUTES),
	data: {
		permissions: { only: [PermissionsEnum.INTEGRATION_VIEW], redirectTo: '/pages/integrations' },
		selectors: { project: false, team: false, employee: false, date: false, organization: true }
	}
};

/**
 * Integrations → Jira (`@gauzy/plugin-integration-jira-ui`): the connect page (OAuth 2.0 through the API's
 * single-use state), and the connection's settings (its Jira Cloud site, its webhook, Jira project ↔ project
 * mappings with a status map and an issue-type filter, imports and their reports, conflicts). Where the API's
 * Jira sync is not loaded (`JIRA_ENABLED` off) the page only says so.
 */
export const IntegrationJiraUiPlugin: PluginUiDefinition = defineDeclarativePlugin('integration-jira', {
	version: '0.1.0',
	location: 'integrations-sections',
	routes: [JIRA_ROUTE],
	permissionKeys: [PermissionsEnum.INTEGRATION_VIEW],
	translationNamespace: 'JIRA',
	translations: { en }
});
