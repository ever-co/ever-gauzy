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
 *     EVER_MOCK_CONFIG_JSON='{"issuer":"https://mock-platform.test"}' node node_modules/@ever-co/connect-tools/dist/mock-platform/bin/ever-mock-platform.mjs --port 18081
 *     EVER_CONNECT_MOCK_PLATFORM_URL=http://127.0.0.1:18081 yarn nx run plugin-ever-connect:test-mock-platform
 *
 * The mock's issuer is an https name (Ever Platform's documents always name an https issuer);
 * `EVER_PLATFORM_ISSUER` tells the plugin, which the SDK accepts for a local address only.
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
	const tap = (async (input: string, init?: RequestInit) => {
		const body = init?.body ? Buffer.from(init.body as Uint8Array).toString('utf8') : null;
		sent.push({ method: String(init?.method ?? 'GET'), url: String(input), body });
		return fetch(input, init);
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

		// Switching off goes to Ever Platform first.
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

		// A revocation in app.ever.co reaches the installation through the feed.
		await mock('consent', { integration: 'stats_link' });
		await readFeed();
		expect((await integration(acme.organizationId, 'operator', 'stats_link')).state).toBe('enabled');
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
