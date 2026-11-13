import { INestApplication, Logger, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TenantPermissionGuard } from '@gauzy/core';
import {
	EVER_ID_SESSION_TOKENS,
	EVER_ID_TOKEN_VAULT,
	EverIdExchangeError,
	EverIdSessionTokensPort,
	isAppLauncherEnabled
} from '@gauzy/plugin-auth-zitadel';
import { EverOperatorService } from '@gauzy/plugin-ever-instance';
import { readEverConnectConfig } from '../ever-connect-config';
import {
	EVER_CONNECT_CLOCK,
	EVER_CONNECT_ENV,
	EVER_CONNECT_FETCH,
	EVER_CONNECT_SETTINGS
} from '../ever-connect.constants';
import { EverConnectModule } from '../ever-connect.module';
import { EverConnectStore } from '../ever-connect.store';
import { EverConnectEnabledGuard } from '../guards/ever-connect-operator.guard';
import { EverConnectLauncherController } from '../launcher/ever-connect-launcher.controller';
import { EverConnectLauncherService } from '../launcher/ever-connect-launcher.service';
import { EverConnectLauncherTokenService } from '../launcher/ever-connect-launcher-token.service';
import {
	EVER_CONNECT_LAUNCHER_SETTINGS,
	isLauncherSwitchedOn,
	MAX_LAUNCHER_ORIGINS,
	readLauncherConfig
} from '../launcher/launcher-config';
import { LAUNCHER_SNAPSHOT_VERSION, mapApps, mapInstalls } from '../launcher/launcher-items';
import { LauncherFirstPartyGuard } from '../launcher/launcher-first-party.guard';
import { LauncherOriginGuard } from '../launcher/launcher-origin.guard';
import { CATALOG_TTL_MS, LauncherReads } from '../launcher/launcher-reads';
import { LauncherTokenVault } from '../launcher/launcher-token-vault';
import { EverConnectSecretStore } from '../ever-connect-secret-store';

jest.setTimeout(30_000);

const ON = { EVER_CONNECT_ENABLED: 'true', ZITADEL_ENABLED: 'true', EVER_APP_LAUNCHER_ENABLED: 'true' };
const WEB = 'https://app.gauzy.example';
const TENANT = 'a0000000-0000-4000-8000-000000000001';
const ORG = 'b0000000-0000-4000-8000-000000000002';
const OTHER_ORG = 'b0000000-0000-4000-8000-000000000003';
const USER = 'c0000000-0000-4000-8000-000000000004';
const EVER_ORG = '01K6A7R9ZV9J8X2M4N5P6R7S8T';

describe('App Launcher settings', () => {
	it('are off unless EVER_APP_LAUNCHER_ENABLED=true (exactly) with Ever ID sign-in loaded', () => {
		expect(readLauncherConfig({}).enabled).toBe(false);
		expect(readLauncherConfig({ EVER_APP_LAUNCHER_ENABLED: 'true' }).enabled).toBe(false);
		expect(readLauncherConfig({ ...ON, EVER_APP_LAUNCHER_ENABLED: 'TRUE' }).enabled).toBe(false);
		expect(readLauncherConfig({ ...ON, EVER_APP_LAUNCHER_ENABLED: '1' }).enabled).toBe(false);
		expect(readLauncherConfig(ON).enabled).toBe(true);
	});

	it('are off while the Ever Platform connection is off, even with the launcher and Ever ID sign-in on', () => {
		expect(readLauncherConfig({ ...ON, EVER_CONNECT_ENABLED: 'false' }).enabled).toBe(false);
		expect(readLauncherConfig({ ...ON, EVER_CONNECT_ENABLED: undefined }).enabled).toBe(false);
		expect(readLauncherConfig({ ...ON, EVER_CONNECT_ENABLED: 'TRUE' }).enabled).toBe(false);
	});

	it("read EVER_APP_LAUNCHER_ENABLED with the Ever ID sign-in plugin's own reader: same answer, same warning", () => {
		for (const value of [undefined, '', 'false', 'true', 'TRUE', '1', 'yes']) {
			const env = { ...ON, EVER_APP_LAUNCHER_ENABLED: value };
			const ours: string[] = [];
			const signIn: string[] = [];
			expect(isLauncherSwitchedOn(env, (message) => ours.push(message))).toBe(
				isAppLauncherEnabled(env, (message) => signIn.push(message))
			);
			expect(ours).toEqual(signIn);
		}
		// One warning for a value that is neither, through the settings too, never repeating the value.
		const warnings: string[] = [];
		expect(readLauncherConfig({ ...ON, EVER_APP_LAUNCHER_ENABLED: 'yes' }, (m) => warnings.push(m)).enabled).toBe(
			false
		);
		const signIn: string[] = [];
		isAppLauncherEnabled({ EVER_APP_LAUNCHER_ENABLED: 'yes' }, (m) => signIn.push(m));
		expect(warnings).toEqual(signIn);
		expect(warnings.join(' ')).not.toContain('yes');
	});

	it('answer the web app origin by default, and at most 50 listed origins', () => {
		expect(readLauncherConfig({ ...ON, CLIENT_BASE_URL: 'https://app.gauzy.example/' }).origins).toEqual([WEB]);
		const warnings: string[] = [];
		const listed = readLauncherConfig(
			{
				...ON,
				EVER_APP_LAUNCHER_ORIGINS: ` ${WEB}, https://teams.example:8443 ,not an origin, https://x.example/path`
			},
			(message) => warnings.push(message)
		);
		expect(listed.origins).toEqual([WEB, 'https://teams.example:8443']);
		expect(warnings.join('\n')).toContain('2 value(s) are not origins');
		expect(warnings.join('\n')).not.toContain('not an origin');
		const many = Array.from({ length: 60 }, (_, i) => `https://o${i}.example`).join(',');
		expect(readLauncherConfig({ ...ON, EVER_APP_LAUNCHER_ORIGINS: many }).origins).toHaveLength(
			MAX_LAUNCHER_ORIGINS
		);
	});

	it('read the catalog from Ever Works over https only, and Manage leads to its web app', () => {
		expect(readLauncherConfig(ON)).toEqual(
			expect.objectContaining({
				catalogUrl: 'https://api.ever.works',
				worksAppUrl: 'https://app.ever.works',
				audience: null
			})
		);
		expect(readLauncherConfig({ ...ON, EVER_WORKS_API_URL: 'http://works.example' }).catalogUrl).toBeNull();
		expect(readLauncherConfig({ ...ON, EVER_WORKS_API_URL: 'http://localhost:3100/' }).catalogUrl).toBe(
			'http://localhost:3100'
		);
		expect(readLauncherConfig({ ...ON, EVER_PLATFORM_PROJECT_ID: ' 330055 ' }).audience).toBe('330055');
	});
});

describe('App Launcher token encryption (EVER_ID_TOKEN_VAULT)', () => {
	const env = { ENCRYPTION_KEY: 'a-strong-unique-encryption-key-for-this-test-only' };

	it('seals with the installation-key encryption under its own purpose, and opens only that', () => {
		const vault = new LauncherTokenVault(env);
		expect(vault.usable()).toBe(true);
		const sealed = vault.seal('{"refreshToken":"refresh-token-value"}');
		expect(sealed).toMatch(/^v1:k:[\w-]+:[\w-]+:[\w-]+$/);
		expect(sealed).not.toContain('refresh-token-value');
		expect(vault.open(sealed)).toBe('{"refreshToken":"refresh-token-value"}');
		// Bound to its purpose: a document of the connection is not a token, and a token is not a document.
		const store = new EverConnectSecretStore(env);
		expect(vault.open(store.seal('a document', 'entitlement'))).toBeNull();
		expect(store.open(sealed, 'entitlement')).toBeNull();
		// Another secret cannot read it.
		expect(
			new LauncherTokenVault({ ENCRYPTION_KEY: 'another-strong-unique-encryption-key-value' }).open(sealed)
		).toBeNull();
	});

	it('is not usable without a safe secret', () => {
		expect(new LauncherTokenVault({}).usable()).toBe(false);
		expect(new LauncherTokenVault({ JWT_SECRET: 'secretKey' }).usable()).toBe(false);
	});
});

describe('App Launcher tiles (the SDK mapping)', () => {
	it('lists installed and delivered installs with an https address only', () => {
		const items = mapInstalls([
			{
				id: 'i1',
				listing_slug: 'a',
				listing_title: 'Alpha',
				listing_type: 'app',
				state: 'installed',
				next_action_url: 'https://alpha.example/'
			},
			{
				id: 'i2',
				listing_slug: 'b',
				listing_title: 'Beta',
				listing_type: 'app',
				state: 'requested',
				next_action_url: 'https://beta.example/'
			},
			{
				id: 'i3',
				listing_slug: 'c',
				listing_title: 'Gamma',
				listing_type: 'app',
				state: 'delivered',
				next_action_url: 'http://gamma.example/'
			},
			{
				id: 'i4',
				listing_slug: 'd',
				listing_title: 'Delta',
				listing_type: 'app',
				state: 'delivered',
				next_action_url: null
			}
		]);
		expect(items.map((item) => [item.key, item.url])).toEqual([['install:i1', 'https://alpha.example/']]);
	});

	it('lists live apps with a deployment address, production first, with Ever Platform deployment states', () => {
		const items = mapApps([
			{
				id: 'a1',
				name: 'Shop',
				status: 'live',
				work_kind: 'store',
				deployments: [
					{ environment: 'preview', status: 'ready', url: 'https://preview.shop.example' },
					{ environment: 'production', status: 'pending', url: 'https://shop.example' }
				]
			},
			{
				id: 'a2',
				name: 'Docs',
				status: 'live',
				deployments: [{ environment: 'production', status: 'error', url: 'https://docs.example' }]
			},
			{
				id: 'a3',
				name: 'Old',
				status: 'live',
				deployments: [{ environment: 'production', status: 'retired', url: 'https://old.example' }]
			},
			{
				id: 'a4',
				name: 'Draft',
				status: 'draft',
				deployments: [{ environment: 'production', status: 'ready', url: 'https://draft.example' }]
			},
			{ id: 'a5', name: 'Nowhere', status: 'live', deployments: [] }
		]);
		expect(items.map((item) => [item.key, item.url, item.chip ?? null, item.workKind ?? null])).toEqual([
			['app:a1', 'https://shop.example/', 'deploying', 'store'],
			['app:a2', 'https://docs.example/', 'lastDeployFailed', null]
		]);
	});
});

describe('App Launcher catalog of Ever apps', () => {
	it('is read once for concurrent callers, kept, and read once again after it expired', async () => {
		const clock = { current: Date.UTC(2026, 10, 7, 12), now: () => clock.current };
		const platform = new FakePlatform();
		const env = { ...ON, EVER_WORKS_API_URL: 'https://api.works.example' };
		const reads = new LauncherReads(
			readEverConnectConfig(env),
			readLauncherConfig(env),
			platform.fetch as unknown as typeof globalThis.fetch,
			clock
		);
		const catalogReads = () => platform.requests.filter((r) => r.url.endsWith('/api/app-launcher/platforms'));

		const first = await Promise.all([reads.catalog(), reads.catalog(), reads.catalog()]);
		expect(catalogReads()).toHaveLength(1);
		expect(first.map((catalog) => catalog.catalogVersion)).toEqual([
			'works-catalog-1',
			'works-catalog-1',
			'works-catalog-1'
		]);
		await reads.catalog();
		expect(catalogReads()).toHaveLength(1);

		clock.current += CATALOG_TTL_MS + 1;
		await Promise.all([reads.catalog(), reads.catalog()]);
		expect(catalogReads()).toHaveLength(2);

		// A failed read is shared too: the bundled list for every caller, from one request.
		clock.current += CATALOG_TTL_MS + 1;
		platform.catalogStatus = 500;
		const fallback = await Promise.all([reads.catalog(), reads.catalog()]);
		expect(catalogReads()).toHaveLength(3);
		expect(fallback.map((catalog) => catalog.catalogVersion)).toEqual([
			LAUNCHER_SNAPSHOT_VERSION,
			LAUNCHER_SNAPSHOT_VERSION
		]);
	});
});

describe('App Launcher routes', () => {
	it('are not registered while the launcher is off (so they answer 404)', async () => {
		for (const env of [
			{},
			{ EVER_CONNECT_ENABLED: 'true' },
			{ ...ON, ZITADEL_ENABLED: 'false' },
			{ ...ON, EVER_APP_LAUNCHER_ENABLED: 'false' },
			// The launcher and Ever ID sign-in on, the Ever Platform connection off: no vault, so no refresh token kept.
			{ ...ON, EVER_CONNECT_ENABLED: 'false' },
			{ ZITADEL_ENABLED: 'true', EVER_APP_LAUNCHER_ENABLED: 'true' }
		]) {
			const registered = EverConnectModule.register(env);
			expect(registered.controllers).not.toContain(EverConnectLauncherController);
			const providers = (registered.providers as Array<Type<unknown> | { provide: unknown }>).map((p) =>
				typeof p === 'function' ? p : p.provide
			);
			for (const launcherProvider of [
				EverConnectLauncherService,
				EverConnectLauncherTokenService,
				LauncherReads,
				LauncherOriginGuard,
				LauncherFirstPartyGuard,
				LauncherTokenVault,
				EVER_CONNECT_LAUNCHER_SETTINGS,
				EVER_ID_TOKEN_VAULT
			]) {
				expect(providers).not.toContain(launcherProvider);
			}
			expect(registered.exports).not.toContain(EVER_ID_TOKEN_VAULT);
		}
		const on = EverConnectModule.register(ON);
		expect(on.controllers).toContain(EverConnectLauncherController);
		expect(on.exports).toContain(EVER_ID_TOKEN_VAULT);

		// The controllers the module registers while off, on an HTTP server: the launcher's routes do not exist.
		const offControllers = (EverConnectModule.register({ EVER_CONNECT_ENABLED: 'true' }).controllers ?? []).filter(
			(controller) => controller === EverConnectLauncherController
		);
		const moduleRef = await Test.createTestingModule({ controllers: offControllers }).compile();
		const app = moduleRef.createNestApplication({ logger: false });
		app.setGlobalPrefix('api');
		await app.listen(0, '127.0.0.1');
		try {
			const base = await app.getUrl();
			for (const path of [
				'/api/ever-connect/launcher/config',
				`/api/ever-connect/launcher/apps?organizationId=${ORG}`
			]) {
				expect(
					(await fetch(`${base.replace('[::1]', '127.0.0.1')}${path}`, { headers: { origin: WEB } })).status
				).toBe(404);
			}
		} finally {
			await app.close();
		}
	});

	describe('switched on', () => {
		let app: INestApplication;
		let base: string;
		let clock: { current: number; now: () => number };
		let platform: FakePlatform;
		let everId: FakeEverId;
		let store: { links: Map<string, { everOrgId: string; status: string }>; members: Set<string> };
		let logs: string[];
		let restoreLogs: () => void;
		let launcherSettings: { audience: string | null };

		beforeEach(async () => {
			clock = { current: Date.UTC(2026, 10, 7, 12), now: () => clock.current };
			platform = new FakePlatform();
			everId = new FakeEverId(clock);
			store = {
				links: new Map([[ORG, { everOrgId: EVER_ORG, status: 'linked' }]]),
				members: new Set([ORG, OTHER_ORG])
			};
			({ logs, restore: restoreLogs } = captureLogs());
			const env = {
				...ON,
				EVER_PLATFORM_API_URL: 'https://api.platform.example',
				EVER_PLATFORM_PROJECT_ID: 'platform-project',
				EVER_WORKS_API_URL: 'https://api.works.example',
				EVER_APP_LAUNCHER_ORIGINS: WEB
			};
			launcherSettings = readLauncherConfig(env);
			const moduleRef = await Test.createTestingModule({
				controllers: [EverConnectLauncherController],
				providers: [
					{ provide: EVER_CONNECT_ENV, useValue: env },
					{ provide: EVER_CONNECT_SETTINGS, useValue: readEverConnectConfig(env) },
					{ provide: EVER_CONNECT_LAUNCHER_SETTINGS, useValue: launcherSettings },
					{ provide: EVER_CONNECT_FETCH, useValue: platform.fetch },
					{ provide: EVER_CONNECT_CLOCK, useValue: clock },
					{ provide: EVER_ID_SESSION_TOKENS, useValue: everId },
					{
						provide: EverConnectStore,
						useValue: {
							isMember: async (tenantId: string, organizationId: string, userId: string) =>
								tenantId === TENANT && userId === USER && store.members.has(organizationId),
							linkOf: async (_tenantId: string, organizationId: string) =>
								store.links.get(organizationId) ?? null
						}
					},
					{ provide: EverOperatorService, useValue: { isOperator: async () => false } },
					EverConnectEnabledGuard,
					LauncherOriginGuard,
					LauncherFirstPartyGuard,
					LauncherReads,
					EverConnectLauncherTokenService,
					EverConnectLauncherService
				]
			})
				// Gauzy's tenant guard is Gauzy's own (its request context); the person is attached as its auth guard does.
				.overrideGuard(TenantPermissionGuard)
				.useValue({ canActivate: () => true })
				.compile();
			app = moduleRef.createNestApplication({ logger: false });
			app.setGlobalPrefix('api');
			app.use(
				(
					request: { user?: unknown; headers: Record<string, string> },
					_response: unknown,
					next: () => void
				) => {
					// As Gauzy's authentication attaches the person; with OAuth app scope enforcement on it also records the
					// app's grant (here when the test asks for it).
					const grant = request.headers['x-test-recorded-grant']
						? { clientId: 'app', scopes: ['profile'] }
						: undefined;
					request.user = {
						id: USER,
						tenantId: TENANT,
						role: { name: 'EMPLOYEE' },
						...(grant ? { oauthApp: grant } : {})
					};
					next();
				}
			);
			await app.listen(0, '127.0.0.1');
			base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
		});

		afterEach(async () => {
			await app.close();
			restoreLogs();
			// No token in any log line, any address that was requested, or any answer the browser got.
			for (const token of [...everId.issued, ...everId.subjects]) {
				for (const line of logs) expect(line).not.toContain(token);
				for (const request of platform.requests) expect(request.url).not.toContain(token);
				for (const body of answers) expect(body).not.toContain(token);
			}
			answers.length = 0;
		});

		const answers: string[] = [];
		async function get(path: string, headers: Record<string, string> = { origin: WEB }) {
			const response = await fetch(`${base}/api/ever-connect/launcher${path}`, { headers });
			const text = await response.text();
			answers.push(text);
			return {
				status: response.status,
				cache: response.headers.get('cache-control'),
				body: text ? JSON.parse(text) : null
			};
		}

		it('answers the configured origins only, before anything is read', async () => {
			expect((await get('/config')).status).toBe(200);
			expect((await get('/config', { 'sec-fetch-site': 'same-origin' })).status).toBe(200);
			for (const headers of [
				{ origin: 'https://evil.example' },
				{ origin: 'null' },
				{},
				{ 'sec-fetch-site': 'cross-site' }
			]) {
				const refused = await get(`/apps?organizationId=${ORG}`, headers);
				expect(refused.status).toBe(403);
				expect(refused.body.code).toBe('origin_not_allowed');
			}
			expect(platform.requests).toEqual([]);
			expect(everId.exchanges).toBe(0);
		});

		it("answers the person's own first-party session only: never a third-party app's token or an API token session", async () => {
			/** An access token as Gauzy issues it (the signature was checked by its authentication, not here). */
			const bearer = (claims: Record<string, unknown>) =>
				`Bearer ${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(
					JSON.stringify({ id: USER, tenantId: TENANT, ...claims })
				).toString('base64url')}.test-signature`;

			const firstParty = await get(`/apps?organizationId=${ORG}`, { origin: WEB, authorization: bearer({}) });
			expect(firstParty.status).toBe(200);
			const exchangesBefore = everId.exchanges;
			const readsBefore = platform.requests.length;

			for (const headers of [
				// An identity-only OAuth app (profile and e-mail): no permission to narrow, still refused.
				{ authorization: bearer({ oauthApp: { clientId: 'third-party-app', scopes: ['profile', 'email'] } }) },
				// An OAuth app with broad scopes.
				{ authorization: bearer({ oauthApp: { clientId: 'third-party-app', scopes: ['read', 'write'] } }) },
				// A session started from a personal API token.
				{ authorization: bearer({ apiTokenId: 'api-token-1' }) },
				// The grant Gauzy's authentication recorded on the person.
				{ 'x-test-recorded-grant': '1' }
			]) {
				for (const path of ['/config', `/apps?organizationId=${ORG}`]) {
					const refused = await get(path, { origin: WEB, ...headers });
					expect(refused.status).toBe(403);
					expect(refused.body.code).toBe('first_party_only');
				}
			}
			expect(everId.exchanges).toBe(exchangesBefore);
			expect(platform.requests.length).toBe(readsBefore);
			expect(Reflect.getMetadata('__guards__', EverConnectLauncherController)).toContain(LauncherFirstPartyGuard);
		});

		it('config: this product, the Manage address, and whether to offer signing in with Ever ID', async () => {
			expect(await get('/config')).toEqual({
				status: 200,
				cache: 'no-store',
				body: {
					enabled: true,
					current: 'ever-gauzy',
					worksAppUrl: 'https://app.ever.works',
					signInAvailable: false
				}
			});
			everId.sid = null;
			expect((await get('/config')).body.signInAvailable).toBe(true);
		});

		it('apps: the Ever apps and the linked organization apps, read with the delegated token in a header only', async () => {
			const answer = await get(`/apps?organizationId=${ORG}`);
			expect(answer.status).toBe(200);
			expect(answer.cache).toBe('no-store');
			expect(answer.body.error).toBeNull();
			expect(answer.body.signInAvailable).toBe(false);
			expect(answer.body.items.map((item: { key: string }) => item.key)).toEqual([
				'platform:ever-gauzy',
				'platform:ever-works',
				'install:inst-1',
				'app:app-1'
			]);
			expect(answer.body.items[0].current).toBe(true);
			expect(answer.body.meta).toEqual(
				expect.objectContaining({
					scopeKey: `org:${EVER_ORG}`,
					worksTotal: 2,
					total: 4,
					pinLimit: 6,
					truncated: false,
					catalogVersion: 'works-catalog-1'
				})
			);

			expect(everId.exchanges).toBe(1);
			expect(everId.requests).toEqual([{ sid: 'sid-1', audience: 'platform-project', scope: 'apps:read' }]);
			expect(platform.requests.map((r) => [r.url, r.authorization])).toEqual([
				['https://api.works.example/api/app-launcher/platforms', null],
				[`https://api.platform.example/v1/orgs/${EVER_ORG}/installs`, `Bearer ${everId.issued[0]}`],
				[`https://api.platform.example/v1/orgs/${EVER_ORG}/apps?limit=100`, `Bearer ${everId.issued[0]}`]
			]);
			expect(platform.requests.every((r) => r.redirect === 'manual' && r.credentials === 'omit')).toBe(true);
		});

		it('reuses an answer for 60 s, and the delegated token until a minute before it expires (one exchange)', async () => {
			await Promise.all([get(`/apps?organizationId=${ORG}`), get(`/apps?organizationId=${ORG}`)]);
			await get(`/apps?organizationId=${ORG}`);
			expect(everId.exchanges).toBe(1);
			const feedReads = () => platform.requests.filter((r) => r.url.includes('/v1/orgs/')).length;
			const afterFirst = feedReads();
			// One read of each feed, whether the two first requests overlapped or not.
			expect(afterFirst).toBe(2);

			clock.current += 61_000;
			await get(`/apps?organizationId=${ORG}`);
			expect(feedReads()).toBe(afterFirst + 2);
			expect(everId.exchanges).toBe(1);

			// The token is used until a minute before it expires; then a new exchange.
			clock.current += 3600_000;
			await get(`/apps?organizationId=${ORG}`);
			expect(everId.exchanges).toBe(2);
		});

		it('shares one read between concurrent requests for the same answer, an answer in error included', async () => {
			const launcher = app.get(EverConnectLauncherService);
			const scope = { tenantId: TENANT, userId: USER, organizationId: ORG, isOperator: false };
			const feedReads = () => platform.requests.filter((r) => r.url.includes('/v1/orgs/')).length;

			const [first, second, third] = await Promise.all([
				launcher.list(scope),
				launcher.list(scope),
				launcher.list(scope)
			]);
			expect(first.error).toBeNull();
			expect(second).toBe(first);
			expect(third).toBe(first);
			expect(feedReads()).toBe(2);
			expect(everId.exchanges).toBe(1);

			// An answer in error is never kept, but concurrent requests still share the one read that failed.
			clock.current += 61_000;
			platform.feedStatus = 503;
			const failed = await Promise.all([launcher.list(scope), launcher.list(scope)]);
			expect(failed.map((answer) => answer.error)).toEqual([
				{ section: 'works', code: 'feed_unavailable' },
				{ section: 'works', code: 'feed_unavailable' }
			]);
			expect(feedReads()).toBe(4);
			expect(logs.filter((line) => line.includes('feed_unavailable'))).toHaveLength(1);

			// ...and the next request reads again.
			platform.feedStatus = 200;
			expect((await launcher.list(scope)).error).toBeNull();
			expect(feedReads()).toBe(6);
		});

		it('never reuses an answer once the Ever ID session it was read with ended', async () => {
			expect((await get(`/apps?organizationId=${ORG}`)).body.meta.worksTotal).toBe(2);
			const feedReads = () => platform.requests.filter((r) => r.url.includes('/v1/orgs/')).length;
			const readsBefore = feedReads();
			// A new Ever ID session: read again with its own token.
			everId.sid = 'sid-2';
			expect((await get(`/apps?organizationId=${ORG}`)).body.meta.worksTotal).toBe(2);
			expect(everId.requests.map((request) => request.sid)).toEqual(['sid-1', 'sid-2']);
			expect(feedReads()).toBe(readsBefore + 2);

			everId.sid = null;
			const after = await get(`/apps?organizationId=${ORG}`);
			expect(after.body.signInAvailable).toBe(true);
			expect(after.body.meta.worksTotal).toBe(0);
		});

		it('shows the Ever apps only, with the works section in error, when Ever Platform cannot answer (and tries again next time)', async () => {
			platform.feedStatus = 503;
			const failed = await get(`/apps?organizationId=${ORG}`);
			expect(failed.status).toBe(200);
			expect(failed.body.error).toEqual({ section: 'works', code: 'feed_unavailable' });
			expect(failed.body.items.every((item: { section: string }) => item.section === 'platforms')).toBe(true);
			expect(logs.some((line) => line.includes('feed_unavailable'))).toBe(true);

			platform.feedStatus = 200;
			const recovered = await get(`/apps?organizationId=${ORG}`);
			expect(recovered.body.error).toBeNull();
			expect(recovered.body.meta.worksTotal).toBe(2);
		});

		it('falls back to the bundled list of Ever apps when Ever Works cannot be read', async () => {
			platform.catalogStatus = 500;
			const answer = await get(`/apps?organizationId=${ORG}`);
			expect(answer.body.meta.catalogVersion).toBe(LAUNCHER_SNAPSHOT_VERSION);
			expect(answer.body.items.filter((item: { section: string }) => item.section === 'platforms').length).toBe(
				6
			);
		});

		it('reports a refused exchange as the works section in error', async () => {
			everId.fail = true;
			const answer = await get(`/apps?organizationId=${ORG}`);
			expect(answer.body.error).toEqual({ section: 'works', code: 'token_unavailable' });
			expect(platform.requests.filter((r) => r.url.includes('/v1/orgs/'))).toEqual([]);
		});

		it('without the Ever Platform audience: the works section not configured, no warning per request, not cached', async () => {
			launcherSettings.audience = null;
			const answer = await get(`/apps?organizationId=${ORG}`);
			expect(answer.body.error).toEqual({ section: 'works', code: 'not_configured' });
			expect(everId.exchanges).toBe(0);
			expect(logs.some((line) => line.includes('not_configured'))).toBe(false);

			launcherSettings.audience = 'platform-project';
			expect((await get(`/apps?organizationId=${ORG}`)).body.error).toBeNull();
		});

		it('an organization that is not linked: an empty works section, and no token is asked for', async () => {
			const answer = await get(`/apps?organizationId=${OTHER_ORG}`);
			expect(answer.body.error).toBeNull();
			expect(answer.body.meta.worksTotal).toBe(0);
			expect(everId.exchanges).toBe(0);
		});

		it('a person without an Ever ID session: the Ever apps and the sign-in offer, no token', async () => {
			everId.sid = null;
			const answer = await get(`/apps?organizationId=${ORG}`);
			expect(answer.body.signInAvailable).toBe(true);
			expect(answer.body.meta.worksTotal).toBe(0);
			expect(everId.exchanges).toBe(0);
		});

		it('an organization the person is not a member of: 403, nothing read', async () => {
			store.members.delete(ORG);
			expect((await get(`/apps?organizationId=${ORG}`)).status).toBe(403);
			expect((await get('/apps?organizationId=not-a-uuid')).status).toBe(400);
			expect(everId.exchanges).toBe(0);
			expect(platform.requests.filter((r) => r.url.includes('/v1/orgs/'))).toEqual([]);
		});
	});
});

/** Every line logged during a test (Nest's logger and the console). */
function captureLogs(): { logs: string[]; restore: () => void } {
	const logs: string[] = [];
	const record = (...args: unknown[]) => logs.push(args.map(String).join(' '));
	const spies = [
		...(['log', 'warn', 'error', 'debug', 'verbose'] as const).map((level) =>
			jest.spyOn(Logger.prototype, level).mockImplementation(record as never)
		),
		...(['log', 'warn', 'error', 'info', 'debug'] as const).map((level) =>
			jest.spyOn(console, level).mockImplementation(record as never)
		)
	];
	return { logs, restore: () => spies.forEach((spy) => spy.mockRestore()) };
}

/** Ever ID through the sign-in plugin's port: one session, exchanges counted, tokens recorded. */
class FakeEverId implements EverIdSessionTokensPort {
	sid: string | null = 'sid-1';
	fail = false;
	exchanges = 0;
	readonly requests: Array<{ sid: string; audience: string; scope: string }> = [];
	readonly issued: string[] = [];
	readonly subjects = ['subject-access-token-secret'];

	constructor(private readonly clock: { now: () => number }) {}

	async sessionOf(userId: string): Promise<string | null> {
		return userId === USER ? this.sid : null;
	}

	async exchange(sid: string, request: { audience: string; scope: string }) {
		this.exchanges++;
		this.requests.push({ sid, ...request });
		if (this.fail) {
			throw new EverIdExchangeError('exchange_refused');
		}
		const token = `delegated-token-${this.exchanges}-secret`;
		this.issued.push(token);
		return { token, expiresAt: Math.floor(this.clock.now() / 1000) + 3600 - 60 };
	}
}

/** Ever Works' catalog and Ever Platform's two reads, recorded. */
class FakePlatform {
	feedStatus = 200;
	catalogStatus = 200;
	readonly requests: Array<{ url: string; authorization: string | null; redirect?: string; credentials?: string }> =
		[];

	readonly fetch = async (input: string, init: RequestInit = {}): Promise<Response> => {
		const headers = new Headers(init.headers);
		this.requests.push({
			url: input,
			authorization: headers.get('authorization'),
			redirect: init.redirect,
			credentials: init.credentials
		});
		const url = new URL(input);
		const json = (status: number, body: unknown) =>
			new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
		if (url.pathname === '/api/app-launcher/platforms') {
			return json(this.catalogStatus, {
				catalogVersion: 'works-catalog-1',
				environment: 'production',
				platforms: [
					{
						key: 'platform:ever-gauzy',
						kind: 'platform',
						section: 'platforms',
						name: 'Ever Gauzy',
						url: 'https://app.gauzy.co/',
						host: 'app.gauzy.co',
						visible: true,
						pinned: false,
						pinOrder: null,
						order: 0,
						manageState: 'listed'
					},
					{
						key: 'platform:ever-works',
						kind: 'platform',
						section: 'platforms',
						name: 'Ever Works',
						url: 'https://app.ever.works/',
						host: 'app.ever.works',
						visible: true,
						pinned: false,
						pinOrder: null,
						order: 1,
						manageState: 'listed'
					},
					{
						key: 'platform:bad',
						kind: 'platform',
						section: 'platforms',
						name: 'Bad',
						url: 'http://bad.example/',
						host: 'bad.example',
						visible: true,
						pinned: false,
						pinOrder: null,
						order: 2,
						manageState: 'listed'
					}
				]
			});
		}
		if (this.feedStatus !== 200) {
			return json(this.feedStatus, { code: 'unavailable' });
		}
		if (url.pathname === `/v1/orgs/${EVER_ORG}/installs`) {
			return json(200, {
				items: [
					{
						id: 'inst-1',
						listing_id: 'l1',
						listing_slug: 'crm',
						listing_title: 'CRM',
						listing_type: 'app',
						mechanism: 'external_link',
						state: 'installed',
						next_action_url: 'https://crm.example/',
						created_at: '2026-11-01T00:00:00Z'
					},
					{
						id: 'inst-2',
						listing_id: 'l2',
						listing_slug: 'wip',
						listing_title: 'Pending',
						listing_type: 'app',
						mechanism: 'external_link',
						state: 'requested',
						next_action_url: 'https://wip.example/',
						created_at: '2026-11-01T00:00:00Z'
					}
				]
			});
		}
		if (url.pathname === `/v1/orgs/${EVER_ORG}/apps`) {
			return json(200, {
				items: [
					{
						id: 'app-1',
						name: 'Shop',
						status: 'live',
						deployments: [{ environment: 'production', status: 'ready', url: 'https://shop.example/' }]
					}
				],
				next_cursor: null
			});
		}
		return json(404, { code: 'not_found' });
	};
}
