import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * The optional sign-in plugins are part of the API only when switched on, and only by the exact
 * value `true`. Every other plugin import of `plugins.ts` is replaced by a stub here, so the test
 * measures the switches and nothing else.
 */
const PLUGINS_SOURCE = readFileSync(join(__dirname, 'plugins.ts'), 'utf8');
const STUBBED = Array.from(PLUGINS_SOURCE.matchAll(/from '((?:@gauzy\/plugin-|\.\/)[^']+)'/g), (match) => match[1]).filter(
	(name) =>
		name !== '@gauzy/plugin-auth-zitadel' &&
		name !== '@gauzy/plugin-auth-keycloak' &&
		name !== '@gauzy/plugin-ever-stats' &&
		name !== '@gauzy/plugin-ever-connect'
);

class AuthZitadelPlugin {}
class AuthKeycloakPlugin {}
class EverStatsPlugin {}
class EverConnectPlugin {}

/** A stand-in plugin class; `init()` mimics the configurable plugins. */
function stubPluginClass() {
	return class StubPlugin {
		static init() {
			return StubPlugin;
		}
	};
}

function loadPlugins(env: Record<string, string | undefined>, before?: () => void): unknown[] {
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
			before?.();
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
			jest.doMock('@gauzy/plugin-ever-stats', () => ({
				EverStatsPlugin,
				isEverStatsEnabled: jest.requireActual('../../../packages/plugins/ever-stats/src/lib/ever-stats-enabled').isEverStatsEnabled
			}));
			jest.doMock('@gauzy/plugin-ever-connect', () => ({
				EverConnectPlugin,
				isEverConnectEnabled: jest.requireActual('../../../packages/plugins/ever-connect/src/lib/ever-connect-enabled').isEverConnectEnabled
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

describe('API plugin list: anonymous usage statistics', () => {
	it.each([
		['unset (the default)', undefined, true, 0],
		['true', 'true', true, 0],
		['false', 'false', false, 0],
		['TRUE', 'TRUE', true, 1],
		['1', '1', true, 1]
	])('EVER_STATS_ENABLED %s: loaded %s, %i log line(s)', (_name, value, loaded, lines) => {
		const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
		try {
			const plugins = loadPlugins({ EVER_STATS_ENABLED: value });
			expect(plugins.includes(EverStatsPlugin)).toBe(loaded);
			expect(warn.mock.calls.filter(([message]) => String(message).includes('EVER_STATS_ENABLED'))).toHaveLength(lines);
		} finally {
			warn.mockRestore();
		}
	});
});

describe('API plugin list: Ever Platform connection', () => {
	it.each([
		['unset (the default)', undefined, false, 0],
		['false', 'false', false, 0],
		['true', 'true', true, 0],
		['TRUE', 'TRUE', false, 1],
		['1', '1', false, 1],
		['yes', 'yes', false, 1]
	])('EVER_CONNECT_ENABLED %s: loaded %s, %i log line(s)', (_name, value, loaded, lines) => {
		const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
		try {
			const plugins = loadPlugins({ EVER_CONNECT_ENABLED: value });
			expect(plugins.includes(EverConnectPlugin)).toBe(loaded);
			expect(warn.mock.calls.filter(([message]) => String(message).includes('EVER_CONNECT_ENABLED'))).toHaveLength(lines);
		} finally {
			warn.mockRestore();
		}
	});

	// The optional plugins are independent: every combination of the switches loads exactly its own.
	const combinations = [false, true].flatMap((stats) =>
		[false, true].flatMap((connect) => [false, true].flatMap((zitadel) => [false, true].map((keycloak) => ({ stats, connect, zitadel, keycloak }))))
	);
	it.each(combinations)('statistics $stats, connection $connect, Ever ID $zitadel, Keycloak $keycloak', ({ stats, connect, zitadel, keycloak }) => {
		const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
		try {
			const plugins = loadPlugins({
				EVER_STATS_ENABLED: stats ? undefined : 'false',
				EVER_CONNECT_ENABLED: connect ? 'true' : undefined,
				ZITADEL_ENABLED: zitadel ? 'true' : undefined,
				KEYCLOAK_ENABLED: keycloak ? 'true' : undefined,
				KEYCLOAK_CLIENT_ID: 'gauzy',
				KEYCLOAK_CLIENT_SECRET: 'a-real-secret',
				KEYCLOAK_REALM: 'gauzy',
				KEYCLOAK_AUTH_SERVER_URL: 'https://id.example.test'
			});
			expect([plugins.includes(EverStatsPlugin), plugins.includes(EverConnectPlugin), plugins.includes(AuthZitadelPlugin), plugins.includes(AuthKeycloakPlugin)]).toEqual([
				stats,
				connect,
				zitadel,
				keycloak
			]);
		} finally {
			warn.mockRestore();
		}
	});
});

describe('API boot order: the settings files are read before the plugin list is built', () => {
	it('preload-env is the first import of main.ts', () => {
		const main = readFileSync(join(__dirname, 'main.ts'), 'utf8');
		const firstImport = main.split(/\r?\n/).find((line) => /^import\b/.test(line));
		expect(firstImport).toBe("import './preload-env';");
		expect(main).not.toMatch(/loadEnv\(\)/);
	});

	/** Starts the API's env loading in a working directory holding `files`, then builds the plugin list. */
	function bootIn(files: Record<string, string>): unknown[] {
		const cwd = process.cwd();
		const dir = mkdtempSync(join(tmpdir(), 'gauzy-api-env-'));
		const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
		const time = jest.spyOn(console, 'time').mockImplementation(() => undefined);
		const timeEnd = jest.spyOn(console, 'timeEnd').mockImplementation(() => undefined);
		try {
			for (const [name, content] of Object.entries(files)) {
				writeFileSync(join(dir, name), content);
			}
			process.chdir(dir);
			return loadPlugins({ EVER_STATS_ENABLED: undefined }, () => {
				require('./preload-env');
			});
		} finally {
			process.chdir(cwd);
			log.mockRestore();
			time.mockRestore();
			timeEnd.mockRestore();
			rmSync(dir, { recursive: true, force: true });
		}
	}

	it.each([
		['.env.local says false', { '.env.local': 'EVER_STATS_ENABLED=false\n' }, false],
		['.env says false', { '.env': 'EVER_STATS_ENABLED=false\n' }, false],
		['.env says false, .env.local true (it wins)', { '.env': 'EVER_STATS_ENABLED=false\n', '.env.local': 'EVER_STATS_ENABLED=true\n' }, true],
		['control: .env.local says true', { '.env.local': 'EVER_STATS_ENABLED=true\n' }, true],
		['control: no settings file', {}, true]
	])('%s: anonymous usage statistics loaded %s', (_name, files, loaded) => {
		expect(bootIn(files).includes(EverStatsPlugin)).toBe(loaded);
	});
});
