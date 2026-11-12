import { PermissionsEnum } from '@gauzy/contracts';
// A namespace import: this project's spec build has no `esModuleInterop` (the plugin's own default import is the bundler's).
import * as en from '../i18n/en.json';
import { IntegrationJiraUiPlugin, JIRA_CHILD_ROUTES, JIRA_LINK, JIRA_PATH, JIRA_ROUTE } from './integration-jira-ui.plugin';

/** The plugin: Integrations → Jira for people who may view integrations, at the catalogue card's path. */
describe('IntegrationJiraUiPlugin', () => {
	it('declares the Integrations page at the catalogue path with its two routes', () => {
		expect(IntegrationJiraUiPlugin.id).toBe('integration-jira');
		expect(IntegrationJiraUiPlugin.routes).toEqual([JIRA_ROUTE]);
		expect(JIRA_PATH).toBe('jira');
		expect(JIRA_LINK).toBe('/pages/integrations/jira');
		expect(JIRA_ROUTE).toMatchObject({
			location: 'integrations-sections',
			path: 'jira',
			data: { permissions: { only: [PermissionsEnum.INTEGRATION_VIEW] }, selectors: { organization: true } }
		});
		expect(JIRA_CHILD_ROUTES.map((route) => route.path)).toEqual(['', ':integrationId']);
		expect(IntegrationJiraUiPlugin.translationNamespace).toBe('JIRA');
		expect(en).toHaveProperty('CONNECT.BUTTON', 'Connect Jira');
		expect(en).toHaveProperty('MAPPINGS.DIRECTIONS.both');
		expect(typeof IntegrationJiraUiPlugin.bootstrap).toBe('function');
	});
});
