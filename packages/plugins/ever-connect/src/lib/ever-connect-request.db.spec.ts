import { CanActivate, ExecutionContext, Global, INestApplication, Injectable, Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ClsModule, ClsService } from 'nestjs-cls';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionGuard, RequestContext, RequestContextMiddleware, RolePermissionModule, TenantPermissionGuard } from '@gauzy/core';
import { EVER_INSTANCE_ENV } from '@gauzy/plugin-ever-instance';
import { EVER_CONNECT_FETCH } from './ever-connect.constants';
import { EverConnectModule } from './ever-connect.module';
import { EverConnectPlatformService } from './ever-connect-platform.service';
import { EverConnectScheduler } from './ever-connect-scheduler.service';
import {
	CORE_TABLES,
	createCoreTables,
	dropTables,
	migrateUp,
	openTestDataSource,
	PLUGIN_TABLES,
	seedTenant,
	SeededTenant,
	TEST_TARGETS
} from './fixtures/test-db';

// Booting the module and Gauzy core from source takes longer than the default 5 s.
jest.setTimeout(180_000);

/** What the test's authentication step attaches: the user, as Gauzy's guard does, and their permissions. */
interface TestUser {
	id: string;
	tenantId: string;
	email: string;
	role: { name: string };
	permissions: string[];
}

/**
 * Stands in for Gauzy's tenant and permission guards (they read role permissions from the
 * database and a cache): the route's `@Permissions(...)` must all be held by the test user.
 */
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

/**
 * The real module in a Nest app on a real database, with Gauzy's request context and role guard:
 * who may reach which route, and that nothing goes out while the installation is not connected.
 * Every request the module could make is recorded (`EVER_CONNECT_FETCH` and the global `fetch`);
 * none is expected in this suite.
 */
describe.each(TEST_TARGETS)('Ever Platform routes on $name', (target) => {
	let dataSource: DataSource;
	let app: INestApplication | undefined;
	let acme: SeededTenant;
	let zephyr: SeededTenant;
	const d = target.name;
	const calls: string[] = [];
	const recordingFetch = (async (input: unknown) => {
		calls.push(String(input));
		throw new TypeError('fetch failed: no network in this test');
	}) as unknown as typeof fetch;
	let globalFetch: jest.SpyInstance;
	const users: Record<string, TestUser> = {};

	beforeAll(async () => {
		dataSource = await openTestDataSource(target);
		await dropTables(dataSource, d, [...PLUGIN_TABLES, ...CORE_TABLES]);
		await createCoreTables(dataSource, d);
		await migrateUp(dataSource);
		acme = await seedTenant(dataSource, d, 'Acme', '2026-01-01 00:00:00', 'ops@acme.example');
		// A stranger who registered a second tenant, with the operator's address.
		zephyr = await seedTenant(dataSource, d, 'Zephyr', '2026-09-01 00:00:00', 'ops@acme.example');
		users['operator'] = {
			id: acme.superAdminId,
			tenantId: acme.tenantId,
			email: 'ops@acme.example',
			role: { name: 'SUPER_ADMIN' },
			permissions: ALL
		};
		users['employee'] = {
			id: acme.employeeId,
			tenantId: acme.tenantId,
			email: 'employee.ops@acme.example',
			role: { name: 'EMPLOYEE' },
			permissions: ['INTEGRATION_VIEW']
		};
		users['editor'] = { ...users['employee'], permissions: ALL };
		users['stranger'] = {
			id: zephyr.superAdminId,
			tenantId: zephyr.tenantId,
			email: 'ops@acme.example',
			role: { name: 'SUPER_ADMIN' },
			permissions: ALL
		};
	});

	beforeEach(() => {
		calls.length = 0;
		globalFetch = jest.spyOn(globalThis, 'fetch').mockImplementation((async (input: unknown) => {
			calls.push(`global ${String(input)}`);
			throw new TypeError('fetch failed');
		}) as never);
	});

	afterEach(async () => {
		await app?.close();
		app = undefined;
		globalFetch.mockRestore();
	});

	afterAll(async () => {
		await dropTables(dataSource, d, [...PLUGIN_TABLES, ...CORE_TABLES]);
		await dataSource.destroy();
	});

	async function start(env: Record<string, string | undefined>): Promise<INestApplication> {
		const full = { EVER_CONNECT_ENABLED: 'true', ...env };
		@Global()
		@Module({
			providers: [
				{ provide: DataSource, useValue: dataSource },
				{ provide: EVER_INSTANCE_ENV, useValue: full },
				{ provide: EVER_CONNECT_FETCH, useValue: recordingFetch }
			],
			exports: [DataSource, EVER_INSTANCE_ENV, EVER_CONNECT_FETCH]
		})
		class TestInfrastructure {}

		const moduleRef = await Test.createTestingModule({
			imports: [
				ClsModule.forRoot({ global: true, middleware: { mount: false } }),
				TestInfrastructure,
				EverConnectModule.register(full)
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

	const OPERATOR_ROUTES: Array<[string, string, unknown]> = [
		['post', '/api/ever-connect/connect', { code: 'EVC-AAAA-BBBB-CCCC' }],
		['post', '/api/ever-connect/disconnect', { confirm: true }],
		['get', '/api/ever-connect/policy', undefined],
		['put', '/api/ever-connect/policy/stats_link', { allowed: false }],
		['put', '/api/ever-connect/public-url', { url: 'https://gauzy.acme.example' }],
		['post', '/api/ever-connect/integrations/stats_link/accept', { accepted: true }],
		['post', '/api/ever-connect/entitlement/import', { jws: 'a.b.c' }]
	];

	it('loaded but not connected: nothing is sent, nothing is scheduled, no client exists', async () => {
		app = await start({ EVER_OPERATOR_USER_IDS: acme.superAdminId, JWT_SECRET: 'request-test-secret' });
		await new Promise((resolve) => setTimeout(resolve, 3_000));
		expect(calls).toEqual([]);
		expect(app.get(EverConnectScheduler).active).toBe(false);
		expect(app.get(EverConnectPlatformService).created).toBe(false);
		const status = await call('get', '/api/ever-connect/status', 'operator');
		expect(status.status).toBe(200);
		expect(status.body).toMatchObject({
			enabled: true,
			connected: false,
			operator: true,
			managed_by: 'operator',
			in_product_consent: false
		});
		expect(calls).toEqual([]);
	});

	it('control: the recording fetch does see a request when one is made (a valid code with key material)', async () => {
		app = await start({
			EVER_OPERATOR_USER_IDS: acme.superAdminId,
			ENCRYPTION_KEY: 'a-strong-encryption-key-for-tests'
		});
		const connect = await call('post', '/api/ever-connect/connect', 'operator', { code: 'EVC-AAAA-BBBB-CCCC' });
		expect(connect.status).toBe(502);
		expect(calls.length).toBeGreaterThan(0);
		expect(new Set(calls)).toEqual(new Set(['https://api.ever.co/.well-known/ever-keys.json']));
	});

	it.each([
		[
			'the stranger of another tenant with the operator address',
			{ EVER_OPERATOR_EMAILS: 'ops@acme.example' },
			'stranger'
		],
		['a super admin not listed', { EVER_OPERATOR_EMAILS: 'someone@else.example' }, 'operator'],
		['any super admin of a two-tenant installation without a list', {}, 'operator'],
		[
			'the listed operator on Ever Cloud',
			{ EVER_INSTALL_SOURCE: 'cloud', EVER_OPERATOR_USER_IDS: 'x' },
			'operator'
		],
		['an employee', { EVER_OPERATOR_USER_IDS: 'x' }, 'employee']
	])('operator routes answer 404 to %s', async (_name, env: Record<string, string | undefined>, user) => {
		const listed: Record<string, string | undefined> =
			env['EVER_OPERATOR_USER_IDS'] === 'x' ? { ...env, EVER_OPERATOR_USER_IDS: acme.superAdminId } : env;
		app = await start({ ...listed, JWT_SECRET: 'request-test-secret' });
		for (const [method, path, body] of OPERATOR_ROUTES) {
			expect([method, path, (await call(method, path, user, body)).status]).toEqual([method, path, 404]);
		}
		expect(calls).toEqual([]);
	});

	it('the operator reaches the operator routes (connect is refused before any call without a strong secret)', async () => {
		app = await start({ EVER_OPERATOR_USER_IDS: acme.superAdminId, JWT_SECRET: 'secretKey' });
		expect((await call('get', '/api/ever-connect/policy', 'operator')).status).toBe(200);
		const noSecret = await call('post', '/api/ever-connect/connect', 'operator', { code: 'EVC-AAAA-BBBB-CCCC' });
		expect(noSecret.status).toBe(422);
		expect(noSecret.body.code).toBe('key_material_missing');
		expect(calls).toEqual([]);
	});

	it('connect checks the code shape locally (no call), and stats_link accept needs something pending', async () => {
		app = await start({
			EVER_OPERATOR_USER_IDS: acme.superAdminId,
			ENCRYPTION_KEY: 'a-strong-encryption-key-for-tests'
		});
		const bad = await call('post', '/api/ever-connect/connect', 'operator', { code: 'EVC-IIII-LLLL-OOOO' });
		expect(bad.status).toBe(422);
		expect(bad.body.code).toBe('code_invalid');
		expect(
			(await call('post', '/api/ever-connect/integrations/stats_link/accept', 'operator', { accepted: true }))
				.status
		).toBe(409);
		expect(
			(await call('put', '/api/ever-connect/public-url', 'operator', { url: 'https://gauzy.acme.example' })).body
				.code
		).toBe('consent_required');
		// An entitlement document cannot be imported before the installation is connected (no call).
		const notConnected = await call('post', '/api/ever-connect/entitlement/import', 'operator', { jws: 'a.b.c' });
		expect(notConnected.status).toBe(409);
		expect(notConnected.body.code).toBe('not_connected');
		expect(calls).toEqual([]);
	});

	it('installation-wide consent links answer 404 to everyone but the operator; per-link ones need the link', async () => {
		app = await start({ EVER_OPERATOR_USER_IDS: acme.superAdminId, JWT_SECRET: 'request-test-secret' });
		for (const key of ['instance_url', 'stats_link']) {
			const path = `/api/ever-connect/integrations/${key}/consent-url?organizationId=${acme.organizationId}`;
			expect((await call('post', path, 'editor')).status).toBe(404);
			expect(
				(
					await call(
						'post',
						`/api/ever-connect/integrations/${key}/consent-url?organizationId=${zephyr.organizationId}`,
						'stranger'
					)
				).status
			).toBe(404);
			// The operator gets through to the state checks (not connected: 409, no call).
			const operator = await call('post', path, 'operator');
			expect(operator.status).toBe(409);
			expect(operator.body.code).toBe('not_connected');
		}
		expect(
			(
				await call(
					'put',
					`/api/ever-connect/integrations/stats_link?organizationId=${acme.organizationId}`,
					'editor',
					{ enabled: false }
				)
			).status
		).toBe(404);
		expect(calls).toEqual([]);
	});

	it('organization routes: the existing integration permissions, members of the organization only', async () => {
		app = await start({ EVER_OPERATOR_USER_IDS: acme.superAdminId, JWT_SECRET: 'request-test-secret' });
		const list = await call(
			'get',
			`/api/ever-connect/integrations?organizationId=${acme.organizationId}`,
			'employee'
		);
		expect(list.status).toBe(200);
		const keys = list.body.map((row: { key: string }) => row.key);
		expect(keys).toContain('stats_link');
		expect(list.body.find((row: { key: string }) => row.key === 'counterparty_lookup').state).toBe('coming_soon');
		expect(list.body.find((row: { key: string }) => row.key === 'counterparty_discoverable').state).toBe(
			'coming_soon'
		);
		// INTEGRATION_EDIT is needed to ask for a consent link or switch anything.
		expect(
			(
				await call(
					'post',
					`/api/ever-connect/integrations/refresh?organizationId=${acme.organizationId}`,
					'employee'
				)
			).status
		).toBe(403);
		expect(
			(
				await call('post', `/api/ever-connect/links?organizationId=${acme.organizationId}`, 'employee', {
					link_code: 'EVL-AAAA-BBBB-CCCC'
				})
			).status
		).toBe(403);
		// Another tenant's organization: 403 for a member of none of it.
		expect(
			(await call('get', `/api/ever-connect/integrations?organizationId=${zephyr.organizationId}`, 'editor'))
				.status
		).toBe(403);
		// Switching on is never done here.
		const on = await call(
			'put',
			`/api/ever-connect/integrations/counterparty_lookup?organizationId=${acme.organizationId}`,
			'editor',
			{ enabled: true }
		);
		expect(on.status).toBe(409);
		expect(on.body.code).toBe('consent_required');
		// The connection details are the operator's only.
		const status = await call('get', `/api/ever-connect/status?organizationId=${acme.organizationId}`, 'employee');
		expect(status.body).toMatchObject({ operator: false, connection: null, pending_approvals: [] });
		expect(calls).toEqual([]);
	});

	it('a link code needs a connection; health is not mounted on an unpaired installation', async () => {
		app = await start({ EVER_OPERATOR_USER_IDS: acme.superAdminId, JWT_SECRET: 'request-test-secret' });
		const link = await call('post', `/api/ever-connect/links?organizationId=${acme.organizationId}`, 'editor', {
			link_code: 'EVL-AAAA-BBBB-CCCC'
		});
		expect(link.status).toBe(409);
		expect(link.body.code).toBe('not_connected');
		expect((await call('get', '/api/ever-connect/health', 'employee')).status).toBe(404);
		expect(calls).toEqual([]);
	});

	it('health on a paired installation: {connected} to a signed-in user', async () => {
		app = await start({
			EVER_OPERATOR_USER_IDS: acme.superAdminId,
			JWT_SECRET: 'request-test-secret',
			EVER_STATS_SERVES: 'gauzy,teams'
		});
		const health = await call('get', '/api/ever-connect/health', 'employee');
		expect(health.status).toBe(200);
		expect(health.body).toEqual({ connected: false });
		expect(health.headers['cache-control']).toBe('no-store');
	});

	it('every route answers 404 once EVER_CONNECT_ENABLED is no longer true, even though the module was loaded', async () => {
		const env: Record<string, string | undefined> = {
			EVER_OPERATOR_USER_IDS: acme.superAdminId,
			JWT_SECRET: 'request-test-secret',
			EVER_STATS_SERVES: 'gauzy,teams'
		};
		app = await start(env);
		expect((await call('get', '/api/ever-connect/status', 'operator')).status).toBe(200);
		const moduleEnv = app.get('EVER_CONNECT_ENV') as Record<string, string | undefined>;
		moduleEnv['EVER_CONNECT_ENABLED'] = 'false';
		const instanceEnv = app.get(EVER_INSTANCE_ENV) as Record<string, string | undefined>;
		instanceEnv['EVER_CONNECT_ENABLED'] = 'false';
		for (const [method, path, body] of [
			...OPERATOR_ROUTES,
			['get', '/api/ever-connect/status', undefined],
			['get', '/api/ever-connect/health', undefined]
		] as Array<[string, string, unknown]>) {
			expect([method, path, (await call(method, path, 'operator', body)).status]).toEqual([method, path, 404]);
		}
	});
});
