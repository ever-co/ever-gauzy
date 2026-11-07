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
import {
	PermissionGuard,
	RequestContext,
	RequestContextMiddleware,
	RolePermissionModule,
	TenantPermissionGuard
} from '@gauzy/core';
import { EVER_INSTANCE_ENV } from '@gauzy/plugin-ever-instance';
import { EVER_CONNECT_FETCH } from './ever-connect.constants';
import { EverConnectModule } from './ever-connect.module';
import { EverConnectScheduler } from './ever-connect-scheduler.service';
import { EverConnectIntegrationStateService } from './ever-connect-integration-state.service';
import { ORGANIZATION_IDENTIFIER_CHANGED } from './subscribers/organization-identifier.subscriber';
import {
	CORE_TABLES,
	createCoreTables,
	dropTables,
	insert,
	migrateUp,
	openTestDataSource,
	PLUGIN_TABLES,
	seedTenant,
	SeededTenant
} from './fixtures/test-db';

/**
 * The counterparty check and discoverability end to end against the Ever Platform mock of the SDK's
 * dev tools (`@ever-co/connect-tools`, the version this plugin pins), as `mock-platform.e2e.spec.ts`
 * runs (CI `build-api`; locally start the mock and set `EVER_CONNECT_MOCK_PLATFORM_URL`):
 *
 *     node node_modules/@ever-co/connect-tools/dist/mock-platform/bin/ever-mock-platform.mjs --port 18081
 *     EVER_CONNECT_MOCK_PLATFORM_URL=http://127.0.0.1:18081 yarn nx run plugin-ever-connect:test-mock-platform
 *
 * The mock validates every body against the contract, answers the lookup from its configured opt-in
 * (`vat` `BG123456789` of `acme`) and records each call with its row.
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

const problemAnswer = (status: number, code: string, headers: Record<string, string> = {}): Response =>
	new Response(JSON.stringify({ type: `https://ever.co/problems/${code}`, title: code, status, code }), {
		status,
		headers: { 'content-type': 'application/problem+json', ...headers }
	});

interface RecordedCall {
	method: string;
	path_template: string;
	row: number | null;
	status: number;
}

async function mock<T>(path: string, body?: unknown): Promise<T> {
	const send = () =>
		fetch(`${MOCK}/__mock/${path}`, {
			method: body === undefined ? 'GET' : 'POST',
			headers: { 'content-type': 'application/json' },
			body: body === undefined ? undefined : JSON.stringify(body)
		});
	// A kept-alive connection the mock closed meanwhile (another suite used it) fails once: ask again.
	const response = await send().catch(() => send());
	if (response.status >= 300) {
		throw new Error(`mock ${path}: ${response.status} ${await response.text()}`);
	}
	return (await response.json()) as T;
}

async function calls(): Promise<RecordedCall[]> {
	const body = await mock<RecordedCall[] | { requests: RecordedCall[] }>('requests');
	return Array.isArray(body) ? body : body.requests;
}

const callsOf = async (row: number, method?: string) =>
	(await calls()).filter((call) => call.row === row && (!method || call.method === method));

function testRootsFile(dir: string, issuer: string): string {
	const script = [
		"import { testKey, testRootEntry } from '@ever-co/connect-tools/mock-platform/keys';",
		`const entry = { ...testRootEntry(${JSON.stringify(new URL(issuer).origin)}), x: testKey('root').x };`,
		'process.stdout.write(JSON.stringify({ keys: [entry] }));'
	].join('\n');
	const roots = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
		cwd: __dirname,
		encoding: 'utf8'
	});
	const file = join(dir, 'roots-root.json');
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

@Module({})
class TestRolePermissionModule {}

const ALL = ['INTEGRATION_VIEW', 'INTEGRATION_ADD', 'INTEGRATION_EDIT', 'INTEGRATION_DELETE'];
/** The rows this flow may call: the connection's own, plus discoverability (12) and the check (13). */
const ALLOWED_ROWS = [1, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13];
const HASH = /\b[0-9a-f]{64}\b/;

suite('the counterparty check and discoverability against the mock platform', () => {
	let dir: string;
	let roots: string;
	let dataSource: DataSource;
	let app: INestApplication | undefined;
	let acme: SeededTenant;
	const users: Record<string, TestUser> = {};
	const sent: Array<{ method: string; url: string; body: string | null; headers: Record<string, string> }> = [];
	let fault: ((method: string, url: string) => Response | null) | null = null;
	const tap = (async (input: string, init?: RequestInit) => {
		const body = init?.body ? Buffer.from(init.body as Uint8Array).toString('utf8') : null;
		const method = String(init?.method ?? 'GET');
		const headers: Record<string, string> = {};
		new Headers(init?.headers as never).forEach((value, key) => (headers[key] = value));
		sent.push({ method, url: String(input), body, headers });
		const faulted = fault?.(method, String(input));
		if (faulted) return faulted;
		// The identifier upload names its link in the path (the contract's only parameter, and all the
		// SDK client sends for it), while the mock of connect-tools 1.0.0-rc.8 looks for the link of
		// every per-link integration in `Ever-Link-Id`. The header is added here, on the way to the
		// mock only, so the rest of its checks (the body, the link, the consent) apply to the upload.
		const identifiers = /\/v1\/instances\/me\/tenant-links\/([0-9A-HJKMNP-TV-Z]{26})\/identifiers$/.exec(
			new URL(String(input)).pathname
		);
		if (identifiers && !headers['ever-link-id']) {
			const forwarded = new Headers(init?.headers as never);
			forwarded.set('ever-link-id', identifiers[1]);
			return fetch(input, { ...init, headers: forwarded });
		}
		return fetch(input, init);
	}) as unknown as typeof fetch;

	beforeAll(() => {
		dir = mkdtempSync(join(tmpdir(), 'ever-connect-lookup-e2e-'));
		roots = testRootsFile(dir, ISSUER);
	});

	afterAll(async () => {
		rmSync(dir, { recursive: true, force: true });
		// The mock closes an idle kept-alive connection after 5 s. Waiting here lets this process see
		// it closed, so a suite run next in the same process does not reuse it.
		await new Promise((resolve) => setTimeout(resolve, 5_500));
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
		users['operator'] = {
			id: acme.superAdminId,
			tenantId: acme.tenantId,
			email: 'ops@acme.example',
			role: { name: 'SUPER_ADMIN' },
			permissions: ALL
		};
		users['viewer'] = {
			id: acme.employeeId,
			tenantId: acme.tenantId,
			email: 'employee.ops@acme.example',
			role: { name: 'EMPLOYEE' },
			permissions: ['INTEGRATION_VIEW']
		};
	});

	afterEach(async () => {
		await app?.close();
		app = undefined;
		if (dataSource?.isInitialized) {
			await dropTables(dataSource, 'better-sqlite3', [...PLUGIN_TABLES, ...CORE_TABLES]);
			await dataSource.destroy();
		}
	});

	function environment(extra: Record<string, string> = {}): Record<string, string | undefined> {
		return {
			EVER_CONNECT_ENABLED: 'true',
			EVER_PLATFORM_API_URL: MOCK,
			EVER_PLATFORM_ISSUER: ISSUER,
			EVER_PLATFORM_ROOT_KEYS_FILE: roots,
			EVER_OPERATOR_USER_IDS: acme.superAdminId,
			ENCRYPTION_KEY: 'a-strong-encryption-key-for-the-lookup-e2e',
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

	const org = () => acme.organizationId;
	const lookup = (items: unknown[], user = 'viewer') =>
		call('post', `/api/ever-connect/lookup?organizationId=${org()}`, user, { items });
	const integration = async (key: string) =>
		(await call('get', `/api/ever-connect/integrations?organizationId=${org()}`, 'operator')).body.find(
			(row: { key: string }) => row.key === key
		);
	/** The states read again, as the page does on return from app.ever.co. */
	const refresh = () => app!.get(EverConnectIntegrationStateService).sync({ force: true });

	async function connect(): Promise<void> {
		app = await start(environment());
		const connected = await call('post', '/api/ever-connect/connect', 'operator', {
			code: 'EVC-TEST-0000-0001',
			organizationId: org()
		});
		expect(connected.status).toBe(200);
		expect(connected.body).toMatchObject({ status: 'connected', link: { handle: 'acme', status: 'linked' } });
		app.get(EverConnectScheduler).stop();
	}

	it('check a contact: refused before the consent; then hashes only, the handle found, answers kept, limits passed on', async () => {
		await connect();
		const before = (await calls()).length;
		// Not enabled: 403 before anything is sent; the row reads "available".
		const refused = await lookup([{ kind: 'vat', value: 'BG123456789' }]);
		expect(refused.status).toBe(403);
		expect(refused.body.code).toBe('integration_disabled');
		// Not enabled: the row follows Ever Platform's reading ("coming soon" while its catalog says so).
		expect((await integration('counterparty_lookup')).enabled).toBe(false);
		expect((await calls()).length).toBe(before);

		// The organization's owner enables it in app.ever.co.
		await mock('consent', { integration: 'counterparty_lookup' });
		await refresh();
		expect(await integration('counterparty_lookup')).toMatchObject({
			state: 'enabled',
			feature_on: true,
			options: { auto_check: false }
		});

		const checked = await lookup([
			{ kind: 'vat', value: ' bg 123 456 789 ' },
			{ kind: 'email', value: 'Billing@Client.example' },
			{ kind: 'vat', value: '123' }
		]);
		expect(checked.status).toBe(200);
		expect(checked.body.items).toEqual([
			{ kind: 'vat', status: 'match', handle: 'acme', features: ['pay', 'invoice_exchange'] },
			{ kind: 'email', status: 'none' },
			{ kind: 'vat', status: 'cannot_be_checked', reason: 'no_country' }
		]);
		expect(checked.headers['cache-control']).toBe('no-store');
		expect((await callsOf(13)).map((c) => `${c.method} ${c.status}`)).toEqual(['GET 200', 'POST 200']);
		const query = sent.find((s) => s.method === 'POST' && s.url.endsWith('/v1/lookup'));
		const body = JSON.parse(query?.body ?? '{}');
		expect(Object.keys(body).sort()).toEqual(['hashes', 'salt_version']);
		expect(body.hashes).toHaveLength(2);
		expect(body.hashes.every((hash: string) => HASH.test(hash))).toBe(true);
		expect(query?.headers['ever-link-id']).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
		for (const value of ['123 456 789', '123456789', 'Billing', 'client.example']) {
			expect(JSON.stringify(sent)).not.toContain(value);
		}

		// Kept: the same check asks nothing.
		await lookup([
			{ kind: 'vat', value: 'BG123456789' },
			{ kind: 'email', value: 'billing@client.example' }
		]);
		expect(await callsOf(13, 'POST')).toHaveLength(1);

		// Ever Platform's refusals and limits are passed on (feature off there, rate limited).
		fault = (method, url) => (url.endsWith('/v1/lookup') ? problemAnswer(403, 'entitlement_required') : null);
		const noFeature = await lookup([{ kind: 'email', value: 'a@one.example' }]);
		expect(noFeature.status).toBe(403);
		expect(noFeature.body.code).toBe('entitlement_required');
		fault = (method, url) =>
			url.endsWith('/v1/lookup') ? problemAnswer(429, 'rate_limited', { 'retry-after': '42' }) : null;
		const limited = await lookup([{ kind: 'email', value: 'a@two.example' }]);
		expect(limited.status).toBe(429);
		expect(limited.headers['retry-after']).toBe('42');
		fault = null;

		// The local limit: at most 30 checks a minute per organization ask Ever Platform.
		let local: request.Response | null = null;
		for (let i = 0; i < 31 && !local; i++) {
			const answer = await lookup([{ kind: 'email', value: `person${i}@three.example` }]);
			if (answer.status === 429) local = answer;
		}
		expect(local?.status).toBe(429);
		expect(Number(local?.headers['retry-after'])).toBeGreaterThan(0);

		// Revoked in app.ever.co: the check is refused again and the kept answers are gone.
		await mock('revoke', { integration: 'counterparty_lookup' });
		await refresh();
		expect((await integration('counterparty_lookup')).state).toBe('revoked_remote');
		expect((await lookup([{ kind: 'vat', value: 'BG123456789' }])).status).toBe(403);
		expect(await dataSource.query('SELECT * FROM "ever_connect_lookup_cache"')).toEqual([]);

		const rows = new Set((await calls()).map((c) => c.row));
		expect([...rows].filter((row) => row !== null && !ALLOWED_ROWS.includes(row))).toEqual([]);
		expect((await calls()).filter((c) => c.row === 13 && c.status >= 400 && c.status !== 429)).toEqual([]);
	});

	it('discoverability: nothing before the opt-in; the tax id uploaded once after it, again on a change; removed when switched off', async () => {
		await connect();
		await dataSource.query('UPDATE "organization" SET "taxId" = ? WHERE "id" = ?', ['DE 123.456.789', org()]);
		// A change without the opt-in: nothing at all.
		ORGANIZATION_IDENTIFIER_CHANGED.next({
			tenantId: acme.tenantId,
			organizationId: org(),
			taxId: 'DE 123.456.789'
		});
		await new Promise((resolve) => setTimeout(resolve, 200));
		expect(await callsOf(12)).toEqual([]);
		expect(await callsOf(13)).toEqual([]);

		// The owner opts in, in app.ever.co: one upload.
		await mock('consent', { integration: 'counterparty_discoverable' });
		await refresh();
		expect((await integration('counterparty_discoverable')).state).toBe('enabled');
		expect((await callsOf(12, 'PUT')).map((c) => c.status)).toEqual([200]);
		const upload = sent.find((s) => s.method === 'PUT' && s.url.includes('/identifiers'));
		expect(JSON.parse(upload?.body ?? '{}')).toEqual({
			hashes: [{ kind: 'vat', salt_version: 1, hash: expect.stringMatching(HASH) }]
		});
		expect(upload?.body).not.toContain('123');
		await refresh();
		expect(await callsOf(12, 'PUT')).toHaveLength(1);

		// The tax id changes: uploaded again.
		await dataSource.query('UPDATE "organization" SET "taxId" = ? WHERE "id" = ?', ['DE999999999', org()]);
		ORGANIZATION_IDENTIFIER_CHANGED.next({ tenantId: acme.tenantId, organizationId: org(), taxId: 'DE999999999' });
		await new Promise((resolve) => setTimeout(resolve, 500));
		expect(await callsOf(12, 'PUT')).toHaveLength(2);

		// Switched off here: the upload removed, Ever Platform told.
		const off = await call(
			'put',
			`/api/ever-connect/integrations/counterparty_discoverable?organizationId=${org()}`,
			'operator',
			{
				enabled: false
			}
		);
		expect(off.status).toBe(200);
		expect(off.body).toMatchObject({ state: 'disabled', pending_remote_revoke: false });
		expect((await callsOf(12, 'DELETE')).map((c) => c.status)).toEqual([204]);
		expect((await callsOf(10)).length).toBeGreaterThan(0);
		const audit = JSON.stringify(await dataSource.query('SELECT "action", "details" FROM "ever_connect_audit"'));
		expect(audit).toContain('identifiers.push');
		expect(audit).toContain('identifiers.delete');
		expect(audit).not.toMatch(HASH);

		const rows = new Set((await calls()).map((c) => c.row));
		expect([...rows].filter((row) => row !== null && !ALLOWED_ROWS.includes(row))).toEqual([]);
	});

	it('EVER_CONNECT_INTEGRATIONS_DENY: both stay off whatever app.ever.co says, and nothing of them is sent', async () => {
		app = await start(
			environment({ EVER_CONNECT_INTEGRATIONS_DENY: 'counterparty_lookup,counterparty_discoverable' })
		);
		expect(
			(
				await call('post', '/api/ever-connect/connect', 'operator', {
					code: 'EVC-TEST-0000-0001',
					organizationId: org()
				})
			).status
		).toBe(200);
		app.get(EverConnectScheduler).stop();
		await mock('consent', { integration: 'counterparty_lookup' });
		await mock('consent', { integration: 'counterparty_discoverable' });
		await dataSource.query('UPDATE "organization" SET "taxId" = ? WHERE "id" = ?', ['DE123456789', org()]);
		await refresh();
		expect((await integration('counterparty_lookup')).state).toBe('denied_by_policy');
		expect((await integration('counterparty_discoverable')).state).toBe('denied_by_policy');
		expect((await lookup([{ kind: 'vat', value: 'BG123456789' }])).status).toBe(403);
		ORGANIZATION_IDENTIFIER_CHANGED.next({ tenantId: acme.tenantId, organizationId: org(), taxId: 'DE123456789' });
		await new Promise((resolve) => setTimeout(resolve, 200));
		expect(await callsOf(12)).toEqual([]);
		expect(await callsOf(13)).toEqual([]);
	});
});
