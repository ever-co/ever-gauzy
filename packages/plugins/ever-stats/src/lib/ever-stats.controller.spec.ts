import { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { RoleGuard } from '@gauzy/core';
import { EverOperatorService } from '@gauzy/plugin-ever-instance';
import { EverStatsController } from './ever-stats.controller';
import { EverStatsModule } from './ever-stats.module';
import { EVER_STATS_ENV } from './ever-stats-scheduler.service';
import { EverStatsService } from './ever-stats.service';
import { EverStatsStateController } from './ever-stats-state.controller';
import { EverStatsOperatorGuard } from './guards/ever-stats-operator.guard';

const OPERATOR = { id: 'operator-id', email: 'ops@acme.test', role: { name: 'SUPER_ADMIN' } };
const OTHER_TENANT_ADMIN = { id: 'other-admin', email: 'admin@other.test', role: { name: 'SUPER_ADMIN' } };
const EMPLOYEE = { id: 'employee-id', email: 'e@acme.test', role: { name: 'EMPLOYEE' } };
const USERS: Record<string, unknown> = { operator: OPERATOR, other: OTHER_TENANT_ADMIN, employee: EMPLOYEE };

/** The routes of the operator controller, and a valid body for each. */
const ROUTES: Array<[string, string, unknown]> = [
	['get', '/api/ever-stats/status', undefined],
	['get', '/api/ever-stats/last', undefined],
	['post', '/api/ever-stats/preview', undefined],
	['put', '/api/ever-stats/enabled', { enabled: false }],
	['post', '/api/ever-stats/send-now', undefined],
	['post', '/api/ever-stats/reset-identity', { confirm: true }]
];

// The first suite of a run loads Gauzy core from source, which can take longer than the default 5 s.
jest.setTimeout(120_000);

describe('Anonymous usage statistics routes', () => {
	let app: INestApplication;
	let cloud = false;
	const stats = {
		status: jest.fn(async () => ({ enabled: true })),
		last: jest.fn(async () => ({ payload: '{}', bytes: 2, sent_at: null, http_status: 202, status: 'sent', period: '2026-10' })),
		preview: jest.fn(async () => ({ valid: true, error: null, payload: '{}', bytes: 2, max_bytes: 16384 })),
		setEnabled: jest.fn(async () => ({ enabled: false })),
		sendNow: jest.fn(async () => ({ reports: [] })),
		resetIdentity: jest.fn(async () => ({ enabled: true })),
		enabled: jest.fn(async () => true)
	};

	async function start(controllers: Array<Type<unknown>>): Promise<INestApplication> {
		const moduleRef = await Test.createTestingModule({
			controllers,
			providers: [
				{ provide: EverStatsService, useValue: stats },
				// The statistics are on, whatever the environment of the test run says.
				{ provide: EVER_STATS_ENV, useValue: {} },
				EverStatsOperatorGuard,
				{
					provide: EverOperatorService,
					// The operator rules themselves are covered by ever-operator.service.spec.ts.
					useValue: { isOperator: async (user: { id?: string } | undefined, role: string) => !cloud && role === 'SUPER_ADMIN' && user?.id === OPERATOR.id }
				}
			]
		})
			// RoleGuard re-checks SUPER_ADMIN through Gauzy's request context, which this test does not boot;
			// the operator guard runs first and already requires it.
			.overrideGuard(RoleGuard)
			.useValue({ canActivate: () => true })
			.compile();
		const instance = moduleRef.createNestApplication();
		instance.setGlobalPrefix('api');
		instance.use((req: { headers: Record<string, string>; user?: unknown }, _res: unknown, next: () => void) => {
			req.user = USERS[req.headers['x-test-user']];
			next();
		});
		await instance.init();
		return instance;
	}

	afterEach(async () => {
		await app?.close();
		cloud = false;
	});

	const call = (method: string, path: string, user: string | null, body?: unknown) => {
		const agent = request(app.getHttpServer()) as unknown as Record<string, (path: string) => request.Test>;
		let req = agent[method](path);
		if (user) req = req.set('x-test-user', user);
		return body === undefined ? req : req.send(body as object);
	};

	it.each(ROUTES)('%s %s: 200 for the operator, never cached', async (method, path, body) => {
		app = await start([EverStatsController]);
		const response = await call(method, path, 'operator', body);
		expect(response.status).toBe(200);
		expect(response.headers['cache-control']).toBe('no-store');
	});

	it.each(ROUTES)('%s %s: 404 for another tenant super admin and for an employee', async (method, path, body) => {
		app = await start([EverStatsController]);
		expect((await call(method, path, 'other', body)).status).toBe(404);
		expect((await call(method, path, 'employee', body)).status).toBe(404);
	});

	it.each(ROUTES)('%s %s: 404 for everyone on cloud', async (method, path, body) => {
		cloud = true;
		app = await start([EverStatsController]);
		expect((await call(method, path, 'operator', body)).status).toBe(404);
	});

	it('passes the actor to the switch and refuses a malformed body', async () => {
		app = await start([EverStatsController]);
		expect((await call('put', '/api/ever-stats/enabled', 'operator', { enabled: 'no' })).status).toBe(400);
		expect((await call('post', '/api/ever-stats/reset-identity', 'operator', {})).status).toBe(400);
		await call('put', '/api/ever-stats/enabled', 'operator', { enabled: false });
		expect(stats.setEnabled).toHaveBeenLastCalledWith(false, OPERATOR.id);
	});

	describe('GET /api/ever-stats/state', () => {
		it('does not exist on an installation without a paired Ever Teams', async () => {
			const controllers = EverStatsModule.register({ EVER_STATS_SERVES: 'gauzy' }).controllers as Array<Type<unknown>>;
			expect(controllers).toEqual([EverStatsController]);
			app = await start(controllers);
			expect((await call('get', '/api/ever-stats/state', null)).status).toBe(404);
		});

		it('answers exactly {"enabled":true} without authentication on a paired installation', async () => {
			const controllers = EverStatsModule.register({ EVER_STATS_SERVES: 'gauzy,teams' }).controllers as Array<Type<unknown>>;
			expect(controllers).toEqual([EverStatsController, EverStatsStateController]);
			app = await start(controllers);
			const response = await call('get', '/api/ever-stats/state', null);
			expect(response.status).toBe(200);
			expect(response.text).toBe('{"enabled":true}');
			expect(response.headers['cache-control']).toBe('no-store');
		});
	});
});
