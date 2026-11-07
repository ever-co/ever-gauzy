import { PermissionsEnum } from '@gauzy/contracts';
// A namespace import: this project's spec build has no `esModuleInterop` (the plugin's own default import is the bundler's).
import * as en from '../i18n/en.json';
import { IntegrationTrelloUiPlugin, TRELLO_CHILD_ROUTES, TRELLO_LINK, TRELLO_PATH, TRELLO_ROUTE } from './integration-trello-ui.plugin';

/** The plugin: Integrations → Trello for people who may view integrations, at the catalogue card's path. */
describe('IntegrationTrelloUiPlugin', () => {
	it('declares the Integrations page at the catalogue path with its two routes', () => {
		expect(IntegrationTrelloUiPlugin.id).toBe('integration-trello');
		expect(IntegrationTrelloUiPlugin.routes).toEqual([TRELLO_ROUTE]);
		expect(TRELLO_PATH).toBe('trello');
		expect(TRELLO_LINK).toBe('/pages/integrations/trello');
		expect(TRELLO_ROUTE).toMatchObject({
			location: 'integrations-sections',
			path: 'trello',
			data: { permissions: { only: [PermissionsEnum.INTEGRATION_VIEW] }, selectors: { organization: true } }
		});
		expect(TRELLO_CHILD_ROUTES.map((route) => route.path)).toEqual(['', ':integrationId']);
		expect(IntegrationTrelloUiPlugin.translationNamespace).toBe('TRELLO');
		expect(en).toHaveProperty('CONNECT.BUTTON', 'Connect Trello');
		expect(en).toHaveProperty('MAPPINGS.DIRECTIONS.both');
		expect(typeof IntegrationTrelloUiPlugin.bootstrap).toBe('function');
	});
});
