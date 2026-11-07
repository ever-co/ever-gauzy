import { PermissionsEnum } from '@gauzy/contracts';
// A namespace import: this project's spec build has no `esModuleInterop` (the plugin's own default import is the bundler's).
import * as en from '../i18n/en.json';
import { IntegrationLinearUiPlugin, LINEAR_CHILD_ROUTES, LINEAR_LINK, LINEAR_PATH, LINEAR_ROUTE } from './integration-linear-ui.plugin';

/** The plugin: Integrations → Linear for people who may view integrations, at the catalogue card's path. */
describe('IntegrationLinearUiPlugin', () => {
	it('declares the Integrations page at the catalogue path with its two routes', () => {
		expect(IntegrationLinearUiPlugin.id).toBe('integration-linear');
		expect(IntegrationLinearUiPlugin.routes).toEqual([LINEAR_ROUTE]);
		expect(LINEAR_PATH).toBe('linear');
		expect(LINEAR_LINK).toBe('/pages/integrations/linear');
		expect(LINEAR_ROUTE).toMatchObject({
			location: 'integrations-sections',
			path: 'linear',
			data: { permissions: { only: [PermissionsEnum.INTEGRATION_VIEW] }, selectors: { organization: true } }
		});
		expect(LINEAR_CHILD_ROUTES.map((route) => route.path)).toEqual(['', ':integrationId']);
		expect(IntegrationLinearUiPlugin.translationNamespace).toBe('LINEAR');
		expect(en).toHaveProperty('CONNECT.BUTTON', 'Connect Linear');
		expect(en).toHaveProperty('MAPPINGS.DIRECTIONS.both');
		expect(typeof IntegrationLinearUiPlugin.bootstrap).toBe('function');
	});
});
