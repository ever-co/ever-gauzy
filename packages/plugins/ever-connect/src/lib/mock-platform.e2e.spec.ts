// cspell:ignore evit
import { CanActivate, ExecutionContext, Global, INestApplication, Injectable, Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ClsModule, ClsService } from 'nestjs-cls';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionGuard, RequestContext, RequestContextMiddleware, RolePermissionModule, TenantPermissionGuard } from '@gauzy/core';
import { EVER_INSTANCE_ENV } from '@gauzy/plugin-ever-instance';
import { EVER_CONNECT_FETCH } from './ever-connect.constants';
import {
	EverConnectOrganizationDeletionSubscriber,
	EverConnectTenantDeletionSubscriber,
	GAUZY_OWNER_DELETED
} from './ever-connect-deletion.subscriber';
import { EverConnectModule } from './ever-connect.module';
import { EverConnectScheduler } from './ever-connect-scheduler.service';
import {
	CORE_TABLES,
	createCoreTables,
	dropTables,
	insert,
	migrateUp,
	openTestDataSource,
	PLUGIN_TABLES,
	q,
	seedTenant,
	SeededTenant
} from './fixtures/test-db';

/**
 * End to end against the Ever Platform mock of the SDK's dev tools (`@ever-co/connect-tools`, the
 * exact version in this plugin's package.json): an independent implementation of every call an
 * installation makes (contract validation of every body, signatures, consent states, the event
 * feed) that records each call it receives. CI runs it in `build-api`; locally:
 *
 *     node node_modules/@ever-co/connect-tools/dist/mock-platform/bin/ever-mock-platform.mjs --port 18081
 *     EVER_CONNECT_MOCK_PLATFORM_URL=http://127.0.0.1:18081 yarn nx run plugin-ever-connect:test-mock-platform
 *
 * The mock's issuer is an https name (`MOCK_ISSUER`, `https://mock-platform.test`: Ever Platform's
 * documents always name an https issuer) served on a local address; `EVER_PLATFORM_ISSUER` tells the
 * plugin, which honours it for a loopback address only.
 *
 * Without `EVER_CONNECT_MOCK_PLATFORM_URL` the suite is skipped, unless
 * `EVER_CONNECT_MOCK_PLATFORM_REQUIRED=true` (CI), where a missing mock fails it.
 */
const MOCK = process.env['EVER_CONNECT_MOCK_PLATFORM_URL'];
const ISSUER = process.env['EVER_CONNECT_MOCK_PLATFORM_ISSUER'] || 'https://mock-platform.test';
const REQUIRED = process.env['EVER_CONNECT_MOCK_PLATFORM_REQUIRED'] === 'true';
const suite = MOCK ? describe : describe.skip;

jest.setTimeout(180_000);

if (REQUIRED && !MOCK) {
	it('the mock platform is required here (EVER_CONNECT_MOCK_PLATFORM_REQUIRED=true), so EVER_CONNECT_MOCK_PLATFORM_URL must be set', () => {
		expect(MOCK).toBeDefined();
	});
}

/** A problem answer as Ever Platform (or a proxy in front of it) would send. */
const problemAnswer = (status: number, code: string): Response =>
	new Response(JSON.stringify({ type: `https://ever.co/problems/${code}`, title: code, status, code }), {
		status,
		headers: { 'content-type': 'application/problem+json' }
	});

interface RecordedCall {
	method: string;
	path_template: string;
	row: number | null;
	status: number;
	user_agent?: string;
}

async function mock<T>(path: string, body?: unknown): Promise<T> {
	const response = await fetch(`${MOCK}/__mock/${path}`, {
		method: body === undefined ? 'GET' : 'POST',
		headers: { 'content-type': 'application/json' },
		body: body === undefined ? undefined : JSON.stringify(body)
	});
	if (response.status >= 300) {
		throw new Error(`mock ${path}: ${response.status} ${await response.text()}`);
	}
	return (await response.json()) as T;
}

async function calls(): Promise<RecordedCall[]> {
	const body = await mock<RecordedCall[] | { requests: RecordedCall[] }>('requests');
	return Array.isArray(body) ? body : body.requests;
}

const rows = async () => (await calls()).map((call) => call.row);

/**
 * The mock's TEST root for `EVER_PLATFORM_ROOT_KEYS_FILE`, from `@ever-co/connect-tools`; with
 * another TEST key's public part (`stranger`), a root under the same kid that signed nothing. The
 * tools are ESM only, so a child Node process reads them.
 */
function testRootsFile(dir: string, issuer: string, keyName: 'root' | 'stranger' = 'root'): string {
	const script = [
		"import { testKey, testRootEntry } from '@ever-co/connect-tools/mock-platform/keys';",
		`const entry = { ...testRootEntry(${JSON.stringify(new URL(issuer).origin)}), x: testKey(${JSON.stringify(keyName)}).x };`,
		'process.stdout.write(JSON.stringify({ keys: [entry] }));'
	].join('\n');
	const roots = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
		cwd: __dirname,
		encoding: 'utf8'
	});
	const file = join(dir, `roots-${keyName}.json`);
	writeFileSync(file, roots);
	return file;
}

interface TestUser {
	id: string;
	tenantId: string;
	email: string;
	role: { name: string };
	permissions: string[];
}

@Injectable()
class TestPermissionGuard implements CanActivate {
	constructor(private readonly reflector: Reflector) {}
	canActivate(context: ExecutionContext): boolean {
		const user = context.switchToHttp().getRequest().user as TestUser | undefined;
		const needed =
			this.reflector.getAllAndOverride<string[]>(PERMISSIONS_METADATA, [
				context.getHandler(),
				context.getClass()
			]) ?? [];
		return Boolean(user) && needed.every((permission) => user!.permissions.includes(permission));
	}
}

/** Gauzy's role permission module needs the ORMs; the test permission guard stands in for it. */
@Module({})
class TestRolePermissionModule {}

const ALL = ['INTEGRATION_VIEW', 'INTEGRATION_ADD', 'INTEGRATION_EDIT', 'INTEGRATION_DELETE'];
/** The outbound-call rows this release may use. */
const ALLOWED_ROWS = [1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 16, 31];

suite('Ever Platform connection against the mock platform', () => {
	let dir: string;
	let roots: string;
	let dataSource: DataSource;
	let app: INestApplication | undefined;
	let acme: SeededTenant;
	let zephyr: SeededTenant;
	const users: Record<string, TestUser> = {};
	const sent: Array<{ method: string; url: string; body: string | null }> = [];
	/** Answers some requests instead of the mock (a redirect, a refusal...); `null` lets every request through. */
	let fault: ((method: string, url: string) => Response | null) | null = null;
	const tap = (async (input: string, init?: RequestInit) => {
		const body = init?.body ? Buffer.from(init.body as Uint8Array).toString('utf8') : null;
		const method = String(init?.method ?? 'GET');
		sent.push({ method, url: String(input), body });
		const faulted = fault?.(method, String(input));
		return faulted ?? fetch(input, init);
	}) as unknown as typeof fetch;

	beforeAll(() => {
		dir = mkdtempSync(join(tmpdir(), 'ever-connect-e2e-'));
		roots = testRootsFile(dir, ISSUER);
	});

	afterAll(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	beforeEach(async () => {
		await mock('reset', {});
		sent.length = 0;
		fault = null;
		dataSource = await openTestDataSource({ name: 'better-sqlite3' });
		await createCoreTables(dataSource, 'better-sqlite3');
		await migrateUp(dataSource);
		await insert(dataSource, 'better-sqlite3', 'integration_type', { id: 'type-all', name: 'All Integrations' });
		acme = await seedTenant(dataSource, 'better-sqlite3', 'Acme', '2026-01-01 00:00:00', 'ops@acme.example');
		zephyr = await seedTenant(dataSource, 'better-sqlite3', 'Zephyr', '2026-09-01 00:00:00', 'ops@zephyr.example');
		users['operator'] = {
			id: acme.superAdminId,
			tenantId: acme.tenantId,
			email: 'ops@acme.example',
			role: { name: 'SUPER_ADMIN' },
			permissions: ALL
		};
		users['editor'] = {
			id: acme.employeeId,
			tenantId: acme.tenantId,
			email: 'employee.ops@acme.example',
			role: { name: 'EMPLOYEE' },
			permissions: ALL
		};
		users['stranger'] = {
			id: zephyr.superAdminId,
			tenantId: zephyr.tenantId,
			email: 'ops@zephyr.example',
			role: { name: 'SUPER_ADMIN' },
			permissions: ALL
		};
	});

	afterEach(async () => {
		await app?.close();
		app = undefined;
		await dropTables(dataSource, 'better-sqlite3', [...PLUGIN_TABLES, ...CORE_TABLES]);
		await dataSource.destroy();
	});

	function environment(extra: Record<string, string> = {}): Record<string, string | undefined> {
		return {
			EVER_CONNECT_ENABLED: 'true',
			EVER_PLATFORM_API_URL: MOCK,
			EVER_PLATFORM_ISSUER: ISSUER,
			EVER_PLATFORM_ROOT_KEYS_FILE: roots,
			EVER_OPERATOR_USER_IDS: acme.superAdminId,
			ENCRYPTION_KEY: 'a-strong-encryption-key-for-the-e2e',
			EVER_CONNECT_FEED_MODE: 'interval',
			CLIENT_BASE_URL: 'http://localhost:4200',
			...extra
		};
	}

	async function start(env: Record<string, string | undefined>): Promise<INestApplication> {
		@Global()
		@Module({
			providers: [
				{ provide: DataSource, useValue: dataSource },
				{ provide: EVER_INSTANCE_ENV, useValue: env },
				{ provide: EVER_CONNECT_FETCH, useValue: tap }
			],
			exports: [DataSource, EVER_INSTANCE_ENV, EVER_CONNECT_FETCH]
		})
		class TestInfrastructure {}

		const moduleRef = await Test.createTestingModule({
			imports: [
				ClsModule.forRoot({ global: true, middleware: { mount: false } }),
				TestInfrastructure,
				EverConnectModule.register(env)
			]
		})
			.overrideModule(RolePermissionModule)
			.useModule(TestRolePermissionModule)
			.overrideGuard(TenantPermissionGuard)
			.useClass(TestPermissionGuard)
			.overrideGuard(PermissionGuard)
			.useClass(TestPermissionGuard)
			.compile();
		const instance = moduleRef.createNestApplication({ logger: false });
		instance.setGlobalPrefix('api');
		const cls = instance.get(ClsService);
		RequestContext.setClsService(cls);
		instance.use((req: { headers: Record<string, string>; user?: unknown }, _res: unknown, next: () => void) => {
			req.user = users[req.headers['x-test-user']];
			next();
		});
		const context = new RequestContextMiddleware(cls);
		instance.use((req: never, res: never, next: () => void) => context.use(req, res, next));
		await instance.init();
		return instance;
	}

	const call = (method: string, path: string, user: string | null, body?: unknown) => {
		const agent = request((app as INestApplication).getHttpServer()) as unknown as Record<
			string,
			(path: string) => request.Test
		>;
		let req = agent[method](path);
		if (user) req = req.set('x-test-user', user);
		return body === undefined ? req : req.send(body as object);
	};

	const integration = async (organizationId: string, user: string, key: string) => {
		const list = await call('get', `/api/ever-connect/integrations?organizationId=${organizationId}`, user);
		expect(list.status).toBe(200);
		return list.body.find((row: { key: string }) => row.key === key);
	};

	/** Reads the event feed once, as the scheduler does (the scheduler itself is stopped in these tests). */
	const readFeed = async () => {
		const scheduler = (app as INestApplication).get(EverConnectScheduler);
		while (await scheduler.readFeed()) {
			/* until the feed is drained */
		}
	};

	it('connect, consent waiting for the operator, accept, switch off, policy, links, disconnect', async () => {
		app = await start(environment());
		expect(await calls()).toEqual([]);

		// Connect with the operator's organization: the redeem carries no address of the installation.
		const connect = await call('post', '/api/ever-connect/connect', 'operator', {
			code: 'evc-test-0000-0001',
			organizationId: acme.organizationId
		});
		expect(connect.status).toBe(200);
		expect(connect.body).toMatchObject({ status: 'connected', link: { handle: 'acme', status: 'linked' } });
		const scheduler = app.get(EverConnectScheduler);
		expect(scheduler.active).toBe(true);
		scheduler.stop();
		const redeem = sent.find((s) => s.url.endsWith('/v1/connect/redeem'));
		const body = JSON.parse(redeem?.body ?? '{}');
		expect(Object.keys(body).sort()).toEqual([
			'code',
			'install_source',
			'kind',
			'product',
			'public_jwk',
			'return_origins',
			'tenant',
			'version'
		]);
		expect(body).toMatchObject({
			code: 'EVC-TEST-0000-0001',
			product: 'gauzy',
			install_source: 'self-hosted',
			kind: 'self_hosted',
			return_origins: ['http://localhost:4200']
		});
		expect(body.tenant).toEqual({ product_tenant_id: acme.tenantId, product_org_id: acme.organizationId });
		expect(JSON.stringify(body)).not.toMatch(/"(url|public_url|base_url)"/);
		expect(Object.keys(body.public_jwk).sort()).toEqual(['crv', 'kty', 'x']);
		expect((await rows()).slice(0, 4)).toEqual([1, 3, 4, 8]);

		const status = await call('get', `/api/ever-connect/status?organizationId=${acme.organizationId}`, 'operator');
		expect(status.body).toMatchObject({
			connected: true,
			operator: true,
			connection: { status: 'connected', owner_handle: 'acme', key_material: 'ok' },
			link: { handle: 'acme' }
		});
		expect(JSON.stringify(status.body)).not.toMatch(/evit_|eyJ/);
		expect(
			(await call('post', '/api/ever-connect/connect', 'operator', { code: 'EVC-TEST-0000-0003' })).status
		).toBe(409);

		// The consent link of an installation-wide integration: the operator's only.
		expect((await integration(acme.organizationId, 'editor', 'stats_link')).state).toBe('available');
		const link = await call(
			'post',
			`/api/ever-connect/integrations/stats_link/consent-url?organizationId=${acme.organizationId}`,
			'operator'
		);
		expect(link.status).toBe(200);
		expect(link.body.url).toMatch(/^https:\/\/app\.ever\.co\/connect\/consent\?/);
		expect(new URL(link.body.url).searchParams.get('return')).toBe('http://localhost:4200/');
		expect(
			(
				await call(
					'post',
					`/api/ever-connect/integrations/stats_link/consent-url?organizationId=${acme.organizationId}`,
					'editor'
				)
			).status
		).toBe(404);

		// The organization consents in app.ever.co; the installation-wide integration waits for the operator.
		await mock('consent', { integration: 'stats_link', operator_accept: 'pending' });
		await readFeed();
		expect((await integration(acme.organizationId, 'operator', 'stats_link')).state).toBe('pending_operator');
		expect(
			(
				await call('get', `/api/ever-connect/status?organizationId=${acme.organizationId}`, 'operator')
			).body.pending_approvals.map((p: { key: string }) => p.key)
		).toEqual(['stats_link']);
		expect(await rows()).not.toContain(11);
		expect(
			(await call('post', '/api/ever-connect/integrations/stats_link/accept', 'editor', { accepted: true }))
				.status
		).toBe(404);
		expect(
			(await call('post', '/api/ever-connect/integrations/stats_link/accept', 'stranger', { accepted: true }))
				.status
		).toBe(404);

		// Only the operator's accept switches it on, and only then does the statistics link go out.
		const accept = await call('post', '/api/ever-connect/integrations/stats_link/accept', 'operator', {
			accepted: true
		});
		expect(accept.status).toBe(200);
		expect(accept.body.state).toBe('enabled');
		const afterAccept = await rows();
		expect(afterAccept.indexOf(11)).toBeGreaterThan(afterAccept.indexOf(31));
		// The statement verified (signed with the statistics key, naming this installation); Ever
		// Platform links a statistics id only once a report under it was accepted, which this test
		// installation never sent: 409, retried at the next heartbeat.
		const link11 = (await calls()).filter((call) => call.row === 11);
		expect(link11.map((call) => call.status)).toEqual([409]);

		// Switching off: off here first, then Ever Platform is told.
		const off = await call(
			'put',
			`/api/ever-connect/integrations/stats_link?organizationId=${acme.organizationId}`,
			'operator',
			{ enabled: false }
		);
		expect(off.status).toBe(200);
		expect(off.body).toMatchObject({ state: 'disabled', revoke_source: 'instance', pending_remote_revoke: false });
		expect((await rows()).filter((row) => row === 10)).toHaveLength(1);

		// The operator's policy: a denied integration answers 409 without a call.
		expect(
			(await call('put', '/api/ever-connect/policy/instance_url', 'operator', { allowed: false })).status
		).toBe(200);
		expect((await integration(acme.organizationId, 'editor', 'instance_url')).state).toBe('denied_by_policy');
		const before = (await calls()).length;
		const denied = await call(
			'post',
			`/api/ever-connect/integrations/instance_url/consent-url?organizationId=${acme.organizationId}`,
			'operator'
		);
		expect(denied.status).toBe(409);
		expect(denied.body.code).toBe('denied_by_policy');
		expect((await calls()).length).toBe(before);

		// Another tenant links its own organization; it still cannot touch the installation-wide integrations.
		const linked = await call(
			'post',
			`/api/ever-connect/links?organizationId=${zephyr.organizationId}`,
			'stranger',
			{ link_code: 'EVL-TEST-0000-0002' }
		);
		expect(linked.status).toBe(201);
		expect(linked.body).toMatchObject({ handle: 'globex', status: 'linked' });
		expect(
			(
				await call('post', `/api/ever-connect/links?organizationId=${zephyr.organizationId}`, 'stranger', {
					link_code: 'EVL-TEST-0000-0002'
				})
			).status
		).toBe(409);
		expect(
			(
				await call(
					'post',
					`/api/ever-connect/integrations/stats_link/consent-url?organizationId=${zephyr.organizationId}`,
					'stranger'
				)
			).status
		).toBe(404);
		expect(
			(
				await call(
					'post',
					`/api/ever-connect/integrations/instance_url/consent-url?organizationId=${zephyr.organizationId}`,
					'stranger'
				)
			).status
		).toBe(404);
		const strangerStatus = await call(
			'get',
			`/api/ever-connect/status?organizationId=${zephyr.organizationId}`,
			'stranger'
		);
		expect(strangerStatus.body).toMatchObject({ operator: false, connection: null, link: { handle: 'globex' } });
		const settings = await dataSource.query(
			`SELECT ${q('better-sqlite3', 'settingsName')} AS n FROM ${q('better-sqlite3', 'integration_setting')}`
		);
		expect(settings.map((row: { n: string }) => row.n)).toEqual(
			expect.arrayContaining(['EVER_LINK_ID', 'EVER_ORG_ID', 'EVER_HANDLE', 'EVER_LINK_STATUS'])
		);

		// The documents: verified and stored encrypted; a refresh with an unchanged document is a 304.
		const entitlement = await call(
			'get',
			`/api/ever-connect/entitlement?organizationId=${zephyr.organizationId}`,
			'stranger'
		);
		expect(entitlement.body.link).toMatchObject({ subject: 'link', handle: 'globex', status: 'valid' });
		expect(entitlement.body.instance).toMatchObject({ subject: 'instance', handle: 'acme' });
		const dump =
			JSON.stringify(await dataSource.query(`SELECT * FROM ${q('better-sqlite3', 'ever_connect_link')}`)) +
			JSON.stringify(await dataSource.query(`SELECT * FROM ${q('better-sqlite3', 'ever_connect_connection')}`)) +
			JSON.stringify(await dataSource.query(`SELECT * FROM ${q('better-sqlite3', 'integration_setting')}`));
		expect(dump).not.toMatch(/eyJ[A-Za-z0-9_-]+\.eyJ/);
		expect(
			(
				await call(
					'post',
					`/api/ever-connect/entitlement/refresh?organizationId=${zephyr.organizationId}`,
					'stranger'
				)
			).status
		).toBe(200);

		// Removing a link: Ever Platform is told, the Gauzy record is archived.
		const removed = await call(
			'delete',
			`/api/ever-connect/links/${linked.body.integration_tenant_id}?organizationId=${zephyr.organizationId}`,
			'stranger'
		);
		expect(removed.status).toBe(204);
		expect(
			(await call('get', `/api/ever-connect/status?organizationId=${zephyr.organizationId}`, 'stranger')).body
				.link
		).toBeNull();
		expect(await rows()).toContain(5);

		// A new consent in app.ever.co (Ever Platform reads it as enabled at once): it waits for the
		// operator's accept again, which holds for one consent only.
		await mock('consent', { integration: 'stats_link' });
		await readFeed();
		expect((await integration(acme.organizationId, 'operator', 'stats_link')).state).toBe('pending_operator');
		expect(
			(await call('post', '/api/ever-connect/integrations/stats_link/accept', 'operator', { accepted: true })).body
				.state
		).toBe('enabled');
		// A revocation in app.ever.co reaches the installation through the feed.
		await mock('revoke', { integration: 'stats_link' });
		await readFeed();
		expect(await integration(acme.organizationId, 'operator', 'stats_link')).toMatchObject({
			state: 'revoked_remote',
			revoke_source: 'platform'
		});

		// The audit: ids and states only.
		const audit = await call(
			'get',
			`/api/ever-connect/audit?organizationId=${acme.organizationId}&limit=100`,
			'operator'
		);
		const actions = audit.body.items.map((row: { action: string }) => row.action);
		expect(actions).toEqual(
			expect.arrayContaining([
				'instance.connect',
				'link.create',
				'consent.grant',
				'integration.enable',
				'integration.disable',
				'policy.change',
				'consent.revoke'
			])
		);
		expect(JSON.stringify(audit.body)).not.toMatch(/@|EVC-|EVL-|evit_|eyJ/);

		// Disconnect: Ever Platform is told; here everything is off whatever it answered.
		const disconnect = await call('post', '/api/ever-connect/disconnect', 'operator', { confirm: true });
		expect(disconnect.body).toEqual({ status: 'disconnected' });
		expect(app.get(EverConnectScheduler).active).toBe(false);
		expect(
			(await call('get', `/api/ever-connect/status?organizationId=${acme.organizationId}`, 'operator')).body
		).toMatchObject({ connected: false, link: null });
		expect((await rows()).at(-1)).toBe(16);

		// Every call is a documented row of this release, refused by nothing, named by the SDK.
		for (const entry of await calls()) {
			expect(ALLOWED_ROWS).toContain(entry.row);
			expect(entry.status).not.toBe(422);
			expect(entry.user_agent).toMatch(/^ever-connect-sdk\/[^ ]+ \(gauzy\/0\.0\.0\)$/);
		}
	});

	/** Connects with the operator's organization; the scheduler is stopped (the tests drive it). */
	const connectAcme = async (code = 'EVC-TEST-0000-0001') => {
		const connected = await call('post', '/api/ever-connect/connect', 'operator', {
			code,
			organizationId: acme.organizationId
		});
		expect(connected.status).toBe(200);
		(app as INestApplication).get(EverConnectScheduler).stop();
		return connected.body as { kid: string };
	};

	/** stats_link consented in app.ever.co, waiting for the operator, then accepted: enabled. */
	const enableStatsLink = async () => {
		await mock('consent', { integration: 'stats_link', operator_accept: 'pending' });
		await readFeed();
		const accepted = await call('post', '/api/ever-connect/integrations/stats_link/accept', 'operator', {
			accepted: true
		});
		expect(accepted.body.state).toBe('enabled');
	};

	const statsLinkCalls = async () => (await calls()).filter((entry) => entry.row === 11).length;

	it('an installation-wide integration Ever Platform reads as enabled still waits for the operator (and again after a new consent)', async () => {
		app = await start(environment());
		await connectAcme();
		// The consent is enabled on Ever Platform at once (no pending_operator there).
		await mock('consent', { integration: 'stats_link' });
		await readFeed();
		expect((await integration(acme.organizationId, 'operator', 'stats_link')).state).toBe('pending_operator');
		expect(
			(
				await call('get', `/api/ever-connect/status?organizationId=${acme.organizationId}`, 'operator')
			).body.pending_approvals.map((p: { key: string }) => p.key)
		).toEqual(['stats_link']);
		expect(await statsLinkCalls()).toBe(0);
		// Re-reading the states changes nothing.
		await call('post', `/api/ever-connect/integrations/refresh?organizationId=${acme.organizationId}`, 'operator');
		expect(await statsLinkCalls()).toBe(0);

		const accepted = await call('post', '/api/ever-connect/integrations/stats_link/accept', 'operator', {
			accepted: true
		});
		expect(accepted.status).toBe(200);
		expect(accepted.body.state).toBe('enabled');
		expect(await statsLinkCalls()).toBe(1);

		// A new consent: waiting for the operator again; nothing more is sent.
		await mock('consent', { integration: 'stats_link' });
		await readFeed();
		expect((await integration(acme.organizationId, 'operator', 'stats_link')).state).toBe('pending_operator');
		expect(await statsLinkCalls()).toBe(1);
	});

	it.each([
		['a redirect (an access proxy)', () => new Response(null, { status: 302, headers: { location: 'https://access.example.test/' } })],
		['a 403', () => problemAnswer(403, 'forbidden')],
		['a 500', () => problemAnswer(500, 'internal_error')]
	])('switching off answers %s from Ever Platform: off here anyway, told again at the next heartbeat', async (_name, answer) => {
		app = await start(environment());
		await connectAcme();
		await enableStatsLink();
		fault = (method, url) => (method === 'PUT' && url.includes('/v1/instances/me/integrations/') ? answer() : null);
		const off = await call(
			'put',
			`/api/ever-connect/integrations/stats_link?organizationId=${acme.organizationId}`,
			'operator',
			{ enabled: false }
		);
		expect(off.status).toBe(200);
		expect(off.body).toMatchObject({ state: 'disabled', enabled: false, pending_remote_revoke: true });

		// The next heartbeat tries again (still refused) and goes on: the documents are read.
		const scheduler = (app as INestApplication).get(EverConnectScheduler);
		const before = (await calls()).length;
		expect(await scheduler.heartbeat()).toBe(true);
		const during = (await calls()).slice(before).map((entry) => entry.row);
		expect(during).toEqual(expect.arrayContaining([6, 8]));
		expect((await integration(acme.organizationId, 'operator', 'stats_link')).pending_remote_revoke).toBe(true);

		// Once Ever Platform takes it, the mark is cleared.
		fault = null;
		expect(await scheduler.heartbeat()).toBe(true);
		expect((await calls()).filter((entry) => entry.row === 10 && entry.status < 300)).toHaveLength(1);
		expect(await integration(acme.organizationId, 'operator', 'stats_link')).toMatchObject({
			state: 'disabled',
			pending_remote_revoke: false
		});
	});

	it('switching off with an unusable EVER_PLATFORM_API_URL: off here anyway, Ever Platform told once it can be', async () => {
		app = await start(environment());
		await connectAcme();
		await enableStatsLink();
		await app.close();
		app = await start(environment({ EVER_PLATFORM_API_URL: 'http://203.0.113.10' }));
		const off = await call(
			'put',
			`/api/ever-connect/integrations/stats_link?organizationId=${acme.organizationId}`,
			'operator',
			{ enabled: false }
		);
		expect(off.status).toBe(200);
		expect(off.body).toMatchObject({ state: 'disabled', pending_remote_revoke: true });
		await app.close();
		app = await start(environment());
		app.get(EverConnectScheduler).stop();
		expect(await app.get(EverConnectScheduler).heartbeat()).toBe(true);
		expect((await integration(acme.organizationId, 'operator', 'stats_link')).pending_remote_revoke).toBe(false);
	});

	it('the connect key: replaced on Ever Platform with two proofs; unreadable after a secret change until a disconnect; one key per connection', async () => {
		app = await start(environment());
		const first = await connectAcme();
		const keyId = async () =>
			(
				await dataSource.query(
					`SELECT ${q('better-sqlite3', 'connectKeyId')} AS k FROM ${q('better-sqlite3', 'ever_instance')}`
				)
			)[0].k as string | null;
		expect(await keyId()).toBe(first.kid);

		// Replace key: Ever Platform installs the new key, and it signs from now on.
		const rotated = await call('post', '/api/ever-connect/connection/rotate-key', 'operator', {});
		expect(rotated.status).toBe(200);
		expect(rotated.body.kid).not.toBe(first.kid);
		expect(await keyId()).toBe(rotated.body.kid);
		const state = await mock<{ instances: Array<{ kid: string }> }>('state');
		expect(state.instances.map((i) => i.kid)).toContain(rotated.body.kid);
		const before = (await calls()).length;
		expect(await app.get(EverConnectScheduler).heartbeat()).toBe(true);
		expect((await calls()).slice(before).map((entry) => entry.row)).toEqual(expect.arrayContaining([4, 6]));
		expect(
			(await call('get', '/api/ever-connect/status', 'operator')).body.connection
		).toMatchObject({ kid: rotated.body.kid, connect_key: 'ok' });

		// ENCRYPTION_KEY changes: the key cannot be read, and the Connection tab says so.
		await app.close();
		app = await start(environment({ ENCRYPTION_KEY: 'another-strong-encryption-key-for-e2e' }));
		app.get(EverConnectScheduler).stop();
		await expect(app.get(EverConnectScheduler).heartbeat()).rejects.toBeDefined();
		expect((await call('get', '/api/ever-connect/status', 'operator')).body.connection).toMatchObject({
			status: 'connected',
			connect_key: 'unreadable',
			last_error: 'key_unreadable'
		});
		const rotateUnreadable = await call('post', '/api/ever-connect/connection/rotate-key', 'operator', {});
		expect(rotateUnreadable.status).toBe(422);
		expect(rotateUnreadable.body.code).toBe('key_unreadable');

		// Disconnect drops the key; connecting again with a new code makes a new one (no 500).
		expect((await call('post', '/api/ever-connect/disconnect', 'operator', { confirm: true })).body).toEqual({
			status: 'disconnected'
		});
		expect(await keyId()).toBeNull();
		await mock('codes', { code: 'EVC-TEST-0000-0009' });
		const again = await connectAcme('EVC-TEST-0000-0009');
		expect(again.kid).not.toBe(rotated.body.kid);
		expect(await keyId()).toBe(again.kid);
		expect((await call('get', '/api/ever-connect/status', 'operator')).body.connection).toMatchObject({
			status: 'connected',
			connect_key: 'ok'
		});

		// A disconnect drops the key every time, not only after a revocation.
		await call('post', '/api/ever-connect/disconnect', 'operator', { confirm: true });
		expect(await keyId()).toBeNull();
	});

	it('a deleted Gauzy organization or tenant: its link is removed on Ever Platform and here, and its rows go', async () => {
		app = await start(environment());
		await connectAcme();
		const linked = await call('post', `/api/ever-connect/links?organizationId=${zephyr.organizationId}`, 'stranger', {
			link_code: 'EVL-TEST-0000-0002'
		});
		expect(linked.status).toBe(201);
		const rowsOf = async (table: string, tenantId: string) =>
			(
				await dataSource.query(
					`SELECT COUNT(*) AS n FROM ${q('better-sqlite3', table)} WHERE ${q('better-sqlite3', 'tenantId')} = ?`,
					[tenantId]
				)
			)[0].n as number;
		expect(await rowsOf('ever_connect_link', zephyr.tenantId)).toBe(1);
		expect(await rowsOf('ever_connect_audit', zephyr.tenantId)).toBeGreaterThan(0);

		// Gauzy deletes Zephyr's organization (soft delete, no entity event here): the next heartbeat
		// finds it before it reads anything for that organization.
		await dataSource.query(
			`UPDATE ${q('better-sqlite3', 'organization')} SET ${q('better-sqlite3', 'deletedAt')} = datetime('now') WHERE ${q('better-sqlite3', 'id')} = ?`,
			[zephyr.organizationId]
		);
		const before = (await calls()).length;
		expect(await app.get(EverConnectScheduler).heartbeat()).toBe(true);
		const removed = (await calls()).slice(before).filter((entry) => entry.row === 5 && entry.method === 'DELETE');
		expect(removed).toHaveLength(1);
		for (const table of ['ever_connect_link', 'ever_connect_integration', 'ever_connect_audit']) {
			expect([table, await rowsOf(table, zephyr.tenantId)]).toEqual([table, 0]);
		}
		const purged = await dataSource.query(
			`SELECT ${q('better-sqlite3', 'tenantId')} AS t, ${q('better-sqlite3', 'details')} AS d FROM ${q('better-sqlite3', 'ever_connect_audit')} WHERE ${q('better-sqlite3', 'action')} = 'link.purge'`
		);
		expect(purged).toHaveLength(1);
		expect(purged[0].t).toBeNull();
		expect(JSON.parse(purged[0].d)).toMatchObject({ reason: 'organization_deleted', remote: true });

		// A tenant deleted through its entity: the subscriber signals, the cleanup follows at once.
		await dataSource.query(`DELETE FROM ${q('better-sqlite3', 'tenant')} WHERE ${q('better-sqlite3', 'id')} = ?`, [
			acme.tenantId
		]);
		const signals: number[] = [];
		const subscription = GAUZY_OWNER_DELETED.subscribe(() => signals.push(1));
		await new EverConnectTenantDeletionSubscriber().afterEntityDelete();
		await new EverConnectOrganizationDeletionSubscriber().afterEntitySoftRemove();
		subscription.unsubscribe();
		expect(signals).toHaveLength(2);
		await new Promise((resolve) => setTimeout(resolve, 2_500));
		expect(await rowsOf('ever_connect_link', acme.tenantId)).toBe(0);
		expect((await calls()).filter((entry) => entry.row === 5 && entry.method === 'DELETE')).toHaveLength(2);
	});

	it('a revoked credential: the installation stops at once and never uses the key again', async () => {
		app = await start(environment());
		expect(
			(await call('post', '/api/ever-connect/connect', 'operator', { code: 'EVC-TEST-0000-0001' })).status
		).toBe(200);
		app.get(EverConnectScheduler).stop();
		const keyBefore = await dataSource.query(
			`SELECT ${q('better-sqlite3', 'connectKeyId')} AS k FROM ${q('better-sqlite3', 'ever_instance')}`
		);
		expect(keyBefore[0].k).toBeTruthy();
		await mock('revoke-instance', {});
		await readFeed().catch(() => undefined);
		await new Promise((resolve) => setTimeout(resolve, 500));
		const status = await call('get', `/api/ever-connect/status?organizationId=${acme.organizationId}`, 'operator');
		expect(status.body.connection).toMatchObject({ status: 'revoked', last_error: 'credential_revoked' });
		const keyAfter = await dataSource.query(
			`SELECT ${q('better-sqlite3', 'connectKeyId')} AS k FROM ${q('better-sqlite3', 'ever_instance')}`
		);
		expect(keyAfter[0].k).toBeNull();
		expect(app.get(EverConnectScheduler).active).toBe(false);
	});

	it('EVER_CONNECT_CODE is used once at start, and never again after a restart', async () => {
		const env = environment({ EVER_CONNECT_CODE: 'EVC-TEST-0000-0001' });
		app = await start(env);
		await new Promise((resolve) => setTimeout(resolve, 1_000));
		expect((await call('get', '/api/ever-connect/status', 'operator')).body.connection).toMatchObject({
			status: 'connected',
			env_code: 'used'
		});
		await app.close();
		app = await start(env);
		await new Promise((resolve) => setTimeout(resolve, 1_000));
		expect((await rows()).filter((row) => row === 3)).toHaveLength(1);
		app.get(EverConnectScheduler).stop();
	});

	it('a refused EVER_CONNECT_CODE is used up (never retried); a code waiting for approval completes once approved', async () => {
		const env = environment({ EVER_CONNECT_CODE: 'EVC-TEST-9999-9999' });
		app = await start(env);
		await new Promise((resolve) => setTimeout(resolve, 1_000));
		expect((await call('get', '/api/ever-connect/status', 'operator')).body.connection).toMatchObject({
			status: 'disconnected',
			env_code: 'used',
			last_error: 'code_invalid'
		});
		await app.close();
		app = await start(env);
		await new Promise((resolve) => setTimeout(resolve, 1_000));
		expect((await rows()).filter((row) => row === 3)).toHaveLength(1);

		const pending = await call('post', '/api/ever-connect/connect', 'operator', { code: 'EVC-TEST-0000-0003' });
		expect(pending.body.status).toBe('pending_approval');
		expect(await rows()).not.toContain(4);
		await mock('approve', {});
		expect((await call('post', '/api/ever-connect/connection/check', 'operator', {})).body).toEqual({
			status: 'connected'
		});
		app.get(EverConnectScheduler).stop();
		expect((await call('get', '/api/ever-connect/status', 'operator')).body.connection.owner_handle).toBe('acme');
	});

	it('keys that cannot be verified: refused before the code is used', async () => {
		const wrongRoots = testRootsFile(dir, ISSUER, 'stranger');
		app = await start(environment({ EVER_PLATFORM_ROOT_KEYS_FILE: wrongRoots }));
		const refused = await call('post', '/api/ever-connect/connect', 'operator', { code: 'EVC-TEST-0000-0001' });
		expect(refused.status).toBe(422);
		expect(refused.body.code).toBe('keys_unverifiable');
		expect(await rows()).toEqual([1]);
		expect((await call('get', '/api/ever-connect/status', 'operator')).body.connected).toBe(false);
	});

	it('Ever Cloud: the operator routes answer 404 to everyone, stats_link is not offered', async () => {
		app = await start(environment({ EVER_INSTALL_SOURCE: 'cloud' }));
		expect(
			(await call('post', '/api/ever-connect/connect', 'operator', { code: 'EVC-TEST-0000-0001' })).status
		).toBe(404);
		const status = await call('get', `/api/ever-connect/status?organizationId=${acme.organizationId}`, 'operator');
		expect(status.body).toMatchObject({ managed_by: 'ever_cloud', operator: false });
		const keys = (
			await call('get', `/api/ever-connect/integrations?organizationId=${acme.organizationId}`, 'operator')
		).body.map((row: { key: string }) => row.key);
		expect(keys).not.toContain('stats_link');
		expect(await calls()).toEqual([]);
	});
});
