import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The optional sign-in plugins are part of the API only when switched on, and only by the exact
 * value `true`. Every other plugin import of `plugins.ts` is replaced by a stub here, so the test
 * measures the switches and nothing else.
 */
const PLUGINS_SOURCE = readFileSync(join(__dirname, 'plugins.ts'), 'utf8');
const STUBBED = Array.from(PLUGINS_SOURCE.matchAll(/from '((?:@gauzy\/plugin-|\.\/)[^']+)'/g), (match) => match[1]).filter(
	(name) => name !== '@gauzy/plugin-auth-zitadel' && name !== '@gauzy/plugin-auth-keycloak'
);

class AuthZitadelPlugin {}
class AuthKeycloakPlugin {}

/** A stand-in plugin class; `init()` mimics the configurable plugins. */
function stubPluginClass() {
	return class StubPlugin {
		static init() {
			return StubPlugin;
		}
	};
}

function loadPlugins(env: Record<string, string | undefined>): unknown[] {
	const saved = { ...process.env };
	Object.assign(process.env, env);
	for (const [key, value] of Object.entries(env)) {
		if (value === undefined) {
			delete process.env[key];
		}
	}
	try {
		let plugins: unknown[] = [];
		jest.isolateModules(() => {
			for (const name of STUBBED) {
				jest.doMock(name, () => new Proxy({}, { get: () => stubPluginClass() }));
			}
			jest.doMock('@gauzy/plugin-auth-zitadel', () => ({
				AuthZitadelPlugin,
				isZitadelEnabled: jest.requireActual('../../../packages/plugins/auth-zitadel/src/lib/auth-zitadel.config').isZitadelEnabled
			}));
			jest.doMock('@gauzy/plugin-auth-keycloak', () => ({
				AuthKeycloakPlugin,
				isKeycloakEnabled: jest.requireActual('../../../packages/plugins/auth-keycloak/src/lib/auth-keycloak.config').isKeycloakEnabled
			}));
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			plugins = require('./plugins').plugins;
		});
		return plugins;
	} finally {
		process.env = saved;
	}
}

describe('API plugin list: optional sign-in plugins', () => {
	const keycloakConfigured = {
		KEYCLOAK_CLIENT_ID: 'gauzy',
		KEYCLOAK_CLIENT_SECRET: 'a-real-secret',
		KEYCLOAK_REALM: 'gauzy',
		KEYCLOAK_AUTH_SERVER_URL: 'https://id.example.test'
	};

	it.each([
		['both off (defaults)', {}, false, false],
		['Ever ID on', { ZITADEL_ENABLED: 'true' }, true, false],
		['Keycloak on', { KEYCLOAK_ENABLED: 'true', ...keycloakConfigured }, false, true],
		['both on', { ZITADEL_ENABLED: 'true', KEYCLOAK_ENABLED: 'true', ...keycloakConfigured }, true, true],
		['Keycloak configured but not switched on', { ...keycloakConfigured }, false, false],
		['Keycloak switched on with the sample placeholders', { ...keycloakConfigured, KEYCLOAK_ENABLED: 'true', KEYCLOAK_CLIENT_ID: 'XXXXXXX', KEYCLOAK_CLIENT_SECRET: 'XXXXXXX' }, false, false],
		['Keycloak switched on without a realm', { ...keycloakConfigured, KEYCLOAK_ENABLED: 'true', KEYCLOAK_REALM: '' }, false, false],
		['ZITADEL_ENABLED=TRUE', { ZITADEL_ENABLED: 'TRUE' }, false, false],
		['ZITADEL_ENABLED=1', { ZITADEL_ENABLED: '1' }, false, false],
		['ZITADEL_ENABLED=yes', { ZITADEL_ENABLED: 'yes' }, false, false],
		['KEYCLOAK_ENABLED=1', { KEYCLOAK_ENABLED: '1', ...keycloakConfigured }, false, false]
	])('%s', (_name, env, zitadel, keycloak) => {
		const plugins = loadPlugins({ ZITADEL_ENABLED: undefined, KEYCLOAK_ENABLED: undefined, ...env });
		expect(plugins.includes(AuthZitadelPlugin)).toBe(zitadel);
		expect(plugins.includes(AuthKeycloakPlugin)).toBe(keycloak);
	});
});
