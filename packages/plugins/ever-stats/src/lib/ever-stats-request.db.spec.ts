import { Global, INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { ClsModule, ClsService } from 'nestjs-cls';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { RequestContext, RequestContextMiddleware } from '@gauzy/core';
import { EVER_INSTANCE_ENV } from '@gauzy/plugin-ever-instance';
import { EverStatsCollector } from './ever-stats-collector.service';
import { EverStatsModule } from './ever-stats.module';
import { EVER_STATS_CLOCK, StatsClock } from './ever-stats-scheduler.service';
import { CANARY_GOLDEN, CANARY_NOW, CanarySeed, canaryLeaks, seedCanaryDatabase } from './fixtures/canary-seed';
import { CORE_TABLES, createCoreTables, dropTables, insert, migrateUp, openTestDataSource, PLUGIN_TABLES, q, TEST_TARGETS } from './fixtures/test-db';

// Booting the module and Gauzy core from source takes longer than the default 5 s.
jest.setTimeout(180_000);

const ROUTES: Array<[string, string, unknown]> = [
	['get', '/api/ever-stats/status', undefined],
	['post', '/api/ever-stats/preview', undefined],
	['put', '/api/ever-stats/enabled', { enabled: true }],
	['post', '/api/ever-stats/reset-identity', { confirm: true }]
];

/**
 * The real module, in a real request: Gauzy's request context (nestjs-cls and
 * `RequestContextMiddleware`) is active with a signed-in super admin of ONE tenant, exactly as when
 * the operator clicks *What is sent*. The report must still count every tenant, and carry none of the
 * database's names, addresses or numbers. The operator check runs on the database (G-SEC: an address
 * registered again in another tenant gets 404).
 */
describe.each(TEST_TARGETS)('Anonymous usage statistics in an operator request on $name', (target) => {
	let dataSource: DataSource;
	let seed: CanarySeed;
	let app: INestApplication | undefined;
	const d = target.name;
	const clock: StatsClock = { now: () => CANARY_NOW.getTime(), random: () => 0.5 };
	/** Users as the authentication guard attaches them (the database state of the caller). */
	const signedIn: Record<string, { id: string; tenantId: string; email: string; role: { name: string } }> = {};

	beforeAll(async () => {
		dataSource = await openTestDataSource(target);
		await dropTables(dataSource, d, [...PLUGIN_TABLES, ...CORE_TABLES]);
		await createCoreTables(dataSource, d);
		await migrateUp(dataSource);
		seed = await seedCanaryDatabase(dataSource, d);
		const role = async (tenantId: string, name: string) => {
			const id = randomUUID();
			await insert(dataSource, d, 'role', { id, name, tenantId });
			return id;
		};
		const acmeSuperAdmin = await role(seed.acme, 'SUPER_ADMIN');
		const acmeEmployee = await role(seed.acme, 'EMPLOYEE');
		const zephyrSuperAdmin = await role(seed.zephyr, 'SUPER_ADMIN');
		const [operatorId, employeeId] = seed.users;
		await dataSource.query(`UPDATE ${q(d, 'user')} SET ${q(d, 'roleId')} = '${acmeSuperAdmin}' WHERE ${q(d, 'id')} = '${operatorId}'`);
		await dataSource.query(`UPDATE ${q(d, 'user')} SET ${q(d, 'roleId')} = '${acmeEmployee}' WHERE ${q(d, 'id')} = '${employeeId}'`);
		const operatorEmail = 'jane.doe@acme-robotics.example';
		// The takeover attempt: the operator's address registered later in another tenant, which makes
		// its registrant that tenant's super admin; once unconfirmed, once confirmed.
		const strangers: Array<[string, string | null]> = [
			['stranger-unconfirmed', null],
			['stranger-confirmed', '2026-09-15 00:00:00']
		];
		for (const [key, verifiedAt] of strangers) {
			const id = randomUUID();
			await insert(dataSource, d, 'user', {
				id,
				tenantId: seed.zephyr,
				email: operatorEmail,
				roleId: zephyrSuperAdmin,
				isActive: true,
				emailVerifiedAt: verifiedAt,
				createdAt: '2026-09-14 00:00:00'
			});
			signedIn[key] = { id, tenantId: seed.zephyr, email: operatorEmail, role: { name: 'SUPER_ADMIN' } };
		}
		signedIn['operator'] = { id: operatorId, tenantId: seed.acme, email: operatorEmail, role: { name: 'SUPER_ADMIN' } };
		signedIn['employee'] = { id: employeeId, tenantId: seed.acme, email: 'oskar.kowalczyk@acme-robotics.example', role: { name: 'EMPLOYEE' } };
	});

	afterEach(async () => {
		await app?.close();
		app = undefined;
		jest.restoreAllMocks();
	});

	afterAll(async () => {
		await dropTables(dataSource, d, [...PLUGIN_TABLES, ...CORE_TABLES]);
		await dataSource.destroy();
	});

	async function start(env: Record<string, string | undefined>): Promise<INestApplication> {
		@Global()
		@Module({
			providers: [
				{ provide: DataSource, useValue: dataSource },
				{ provide: EVER_INSTANCE_ENV, useValue: env },
				{ provide: EVER_STATS_CLOCK, useValue: clock }
			],
			exports: [DataSource, EVER_INSTANCE_ENV, EVER_STATS_CLOCK]
		})
		class TestInfrastructure {}

		const moduleRef = await Test.createTestingModule({
			imports: [ClsModule.forRoot({ global: true, middleware: { mount: false } }), TestInfrastructure, EverStatsModule.register(env)]
		}).compile();
		const instance = moduleRef.createNestApplication({ logger: false });
		instance.setGlobalPrefix('api');
		const cls = instance.get(ClsService);
		RequestContext.setClsService(cls);
		// What Gauzy's authentication guard does: attach the caller as loaded from the database.
		instance.use((req: { headers: Record<string, string>; user?: unknown }, _res: unknown, next: () => void) => {
			req.user = signedIn[req.headers['x-test-user']];
			next();
		});
		const context = new RequestContextMiddleware(cls);
		instance.use((req: never, res: never, next: () => void) => context.use(req, res, next));
		await instance.init();
		return instance;
	}

	const call = (method: string, path: string, user: string | null, body?: unknown) => {
		const agent = request((app as INestApplication).getHttpServer()) as unknown as Record<string, (path: string) => request.Test>;
		let req = agent[method](path);
		if (user) req = req.set('x-test-user', user);
		return body === undefined ? req : req.send(body as object);
	};

	it('What is sent, inside the operator request of one tenant, counts every tenant and leaks nothing (canary)', async () => {
		const seen: Array<{ tenantId: string | null; tenantOrganizations: number }> = [];
		const collect = EverStatsCollector.prototype.collect;
		jest.spyOn(EverStatsCollector.prototype, 'collect').mockImplementation(async function (this: EverStatsCollector, ...args) {
			// Control: a read scoped like Gauzy's tenant-aware services, in the same request, sees one
			// tenant only. The report must not.
			const tenantId = RequestContext.currentTenantId();
			const rows = await dataSource.query(
				`SELECT COUNT(*) AS n FROM ${q(d, 'organization')} WHERE ${q(d, 'deletedAt')} IS NULL AND ${q(d, 'tenantId')} = '${tenantId}'`
			);
			seen.push({ tenantId, tenantOrganizations: Number(rows[0].n) });
			return collect.apply(this, args);
		});
		app = await start({ EVER_OPERATOR_USER_IDS: signedIn['operator'].id, JWT_SECRET: 'request-test-secret' });

		const response = await call('post', '/api/ever-stats/preview', 'operator');
		expect(response.status).toBe(200);
		expect(seen).toEqual([{ tenantId: seed.acme, tenantOrganizations: 2 }]);
		const report = JSON.parse(response.body.payload);
		expect(response.body.valid).toBe(true);
		expect(report.period).toBe('2026-09');
		// The canary database, plus the two accounts of the takeover attempt below (in the other tenant).
		expect(report.counts).toEqual({ ...CANARY_GOLDEN.counts, users: CANARY_GOLDEN.counts.users + 2 });
		expect(report.aggregates).toEqual(CANARY_GOLDEN.aggregates);
		expect(canaryLeaks(seed.seeded, response.body.payload)).toEqual([]);
		expect(canaryLeaks(seed.seeded, JSON.stringify(response.body))).toEqual([]);
	});

	it('the operator by address is the first account with it; the same address registered later in another tenant gets 404', async () => {
		app = await start({ EVER_OPERATOR_EMAILS: 'Jane.Doe@acme-robotics.example', JWT_SECRET: 'request-test-secret' });
		for (const [method, path, body] of ROUTES) {
			expect((await call(method, path, 'stranger-unconfirmed', body)).status).toBe(404);
			expect((await call(method, path, 'stranger-confirmed', body)).status).toBe(404);
			expect((await call(method, path, 'employee', body)).status).toBe(404);
		}
		expect((await call('get', '/api/ever-stats/status', 'operator')).status).toBe(200);
		expect((await call('put', '/api/ever-stats/enabled', 'operator', { enabled: true })).status).toBe(200);
	});

	it('every route answers 404 once EVER_STATS_ENABLED=false is read, even though the module was loaded', async () => {
		const env: Record<string, string | undefined> = { EVER_OPERATOR_USER_IDS: signedIn['operator'].id, JWT_SECRET: 'request-test-secret' };
		app = await start(env);
		expect((await call('get', '/api/ever-stats/status', 'operator')).status).toBe(200);
		env['EVER_STATS_ENABLED'] = 'false';
		for (const [method, path, body] of ROUTES) {
			expect((await call(method, path, 'operator', body)).status).toBe(404);
		}
	});
});
