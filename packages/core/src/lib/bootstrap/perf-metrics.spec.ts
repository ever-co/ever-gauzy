import { EventEmitter } from 'node:events';
import { createPerfMetricsMiddleware, currentRequestPerf, instrumentPg, pgPoolStats } from './perf-metrics';

/**
 * A stand-in for the `pg` module: a Client whose query answers through a callback or a promise, and a Pool
 * whose connect answers through a callback or a promise, each after a short delay.
 */
function fakePg() {
	class Client {
		query(...args: any[]) {
			const last = args[args.length - 1];
			if (typeof last === 'function') {
				setTimeout(() => last(null, { rows: [] }), 2);
				return undefined;
			}
			return new Promise((resolve) => setTimeout(() => resolve({ rows: [] }), 2));
		}
	}
	class Pool {
		options = { max: 3 };
		totalCount = 1;
		idleCount = 0;
		waitingCount = 0;
		connect(cb?: (err: unknown, client?: unknown, release?: () => void) => void) {
			if (cb) {
				setTimeout(() => cb(null, new Client(), () => undefined), 5);
				return undefined;
			}
			return new Promise((resolve) => setTimeout(() => resolve(new Client()), 5));
		}
	}
	return { Client, Pool };
}

function fakeResponse() {
	const res: any = new EventEmitter();
	res.headers = {};
	res.headersSent = false;
	res.statusCode = 200;
	res.setHeader = (name: string, value: string) => (res.headers[name.toLowerCase()] = value);
	res.writeHead = function () {
		res.headersSent = true;
		return res;
	};
	return res;
}

describe('perf-metrics', () => {
	const pg = fakePg();
	const env = { ...process.env };

	beforeAll(() => {
		expect(instrumentPg(pg)).toBe(true);
	});

	afterEach(() => {
		process.env = { ...env };
	});

	it('leaves queries outside a measured request untouched', async () => {
		expect(currentRequestPerf()).toBeUndefined();
		await new pg.Client().query('select 1');
		expect(currentRequestPerf()).toBeUndefined();
	});

	it('attributes callback and promise queries and pool checkouts to the request that ran them', async () => {
		const middleware = createPerfMetricsMiddleware();
		const res = fakeResponse();
		const store = await new Promise<any>((resolve) => {
			middleware({ method: 'GET', url: '/api/x' } as any, res, async () => {
				const pool = new pg.Pool();
				const client: any = await pool.connect();
				await client.query('select 1');
				await new Promise((done) => client.query('select 2', [], done));
				await new Promise((done) => pool.connect(done as any));
				resolve(currentRequestPerf());
			});
		});
		expect(store.queries).toBe(2);
		expect(store.queryMs).toBeGreaterThan(0);
		expect(store.poolWaits).toBe(2);
		expect(store.poolWaitMs).toBeGreaterThan(0);
		expect(pgPoolStats()[0]).toEqual({ max: 3, total: 1, idle: 0, waiting: 0 });
	});

	it('writes a Server-Timing header when asked to', async () => {
		process.env.API_SERVER_TIMING = 'true';
		const middleware = createPerfMetricsMiddleware();
		const res = fakeResponse();
		await new Promise<void>((resolve) =>
			middleware({ method: 'GET', url: '/api/x' } as any, res, async () => {
				await new pg.Client().query('select 1');
				res.writeHead(200);
				resolve();
			})
		);
		expect(res.headers['server-timing']).toMatch(/^total;dur=[\d.]+, db;dur=[\d.]+;desc="1 queries", pool;dur=[\d.]+$/);
	});

	it('logs a request slower than API_SLOW_REQUEST_LOG_MS', async () => {
		process.env.API_SLOW_REQUEST_LOG_MS = '1';
		const warn = jest.fn();
		const middleware = createPerfMetricsMiddleware({ logger: { warn } });
		const res = fakeResponse();
		await new Promise<void>((resolve) =>
			middleware({ method: 'GET', originalUrl: '/api/slow?token=secret' } as any, res, async () => {
				await new pg.Client().query('select 1');
				await new Promise((done) => setTimeout(done, 5));
				res.emit('finish');
				resolve();
			})
		);
		expect(warn).toHaveBeenCalledTimes(1);
		// The query string is never logged: it can carry tokens.
		expect(warn.mock.calls[0][0]).toMatch(/^Slow request GET \/api\/slow 200 [\d.]+ms \(db [\d.]+ms in 1 queries, pool wait [\d.]+ms\)$/);
	});
});
