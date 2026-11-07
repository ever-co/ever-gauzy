import { PermissionsEnum } from '@gauzy/contracts';
// A namespace import: this project's spec build has no `esModuleInterop` (the plugin's own default import is the bundler's).
import * as en from '../i18n/en.json';
import { ASANA_CHILD_ROUTES, ASANA_LINK, ASANA_PATH, ASANA_ROUTE, IntegrationAsanaUiPlugin } from './integration-asana-ui.plugin';

/** The plugin: Integrations → Asana for people who may view integrations, at the catalogue card's path. */
describe('IntegrationAsanaUiPlugin', () => {
	it('declares the Integrations page at the catalogue path with its two routes', () => {
		expect(IntegrationAsanaUiPlugin.id).toBe('integration-asana');
		expect(IntegrationAsanaUiPlugin.routes).toEqual([ASANA_ROUTE]);
		expect(ASANA_PATH).toBe('asana');
		expect(ASANA_LINK).toBe('/pages/integrations/asana');
		expect(ASANA_ROUTE).toMatchObject({
			location: 'integrations-sections',
			path: 'asana',
			data: { permissions: { only: [PermissionsEnum.INTEGRATION_VIEW] }, selectors: { organization: true } }
		});
		expect(ASANA_CHILD_ROUTES.map((route) => route.path)).toEqual(['', ':integrationId']);
		expect(IntegrationAsanaUiPlugin.translationNamespace).toBe('ASANA');
		expect(en).toHaveProperty('CONNECT.BUTTON', 'Connect Asana');
		expect(en).toHaveProperty('MAPPINGS.DIRECTIONS.both');
		expect(typeof IntegrationAsanaUiPlugin.bootstrap).toBe('function');
	});
});
