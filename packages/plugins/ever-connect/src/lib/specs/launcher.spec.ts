import { INestApplication, Logger, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TenantPermissionGuard } from '@gauzy/core';
import {
	EVER_ID_SESSION_TOKENS,
	EVER_ID_TOKEN_VAULT,
	EverIdExchangeError,
	EverIdSessionTokensPort
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
import { EVER_CONNECT_LAUNCHER_SETTINGS, MAX_LAUNCHER_ORIGINS, readLauncherConfig } from '../launcher/launcher-config';
import { LAUNCHER_SNAPSHOT_VERSION, mapApps, mapInstalls } from '../launcher/launcher-items';
import { LauncherOriginGuard } from '../launcher/launcher-origin.guard';
import { LauncherReads } from '../launcher/launcher-reads';
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

describe('App Launcher routes', () => {
	it('are not registered while the launcher is off (so they answer 404)', async () => {
		for (const env of [
			{},
			{ EVER_CONNECT_ENABLED: 'true' },
			{ ...ON, ZITADEL_ENABLED: 'false' },
			{ ...ON, EVER_APP_LAUNCHER_ENABLED: 'false' }
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
			const moduleRef = await Test.createTestingModule({
				controllers: [EverConnectLauncherController],
				providers: [
					{ provide: EVER_CONNECT_ENV, useValue: env },
					{ provide: EVER_CONNECT_SETTINGS, useValue: readEverConnectConfig(env) },
					{ provide: EVER_CONNECT_LAUNCHER_SETTINGS, useValue: readLauncherConfig(env) },
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
			app.use((request: { user?: unknown }, _response: unknown, next: () => void) => {
				request.user = { id: USER, tenantId: TENANT, role: { name: 'EMPLOYEE' } };
				next();
			});
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
			expect(afterFirst).toBeLessThanOrEqual(4);

			clock.current += 61_000;
			await get(`/apps?organizationId=${ORG}`);
			expect(feedReads()).toBe(afterFirst + 2);
			expect(everId.exchanges).toBe(1);

			// The token is used until a minute before it expires; then a new exchange.
			clock.current += 3600_000;
			await get(`/apps?organizationId=${ORG}`);
			expect(everId.exchanges).toBe(2);
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
