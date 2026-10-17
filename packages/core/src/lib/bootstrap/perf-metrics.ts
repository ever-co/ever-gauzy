import { AsyncLocalStorage } from 'node:async_hooks';
import { monitorEventLoopDelay, performance } from 'node:perf_hooks';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Opt-in request performance instrumentation.
 *
 * Every switch below is OFF by default, and while it is off nothing is patched, no store is entered and no
 * timer runs, so a deployment that does not ask for it pays nothing.
 *
 * - `API_PERF_METRICS=true`          Count, per request, the SQL statements the request ran, the time spent in
 *                                    them, and the time spent WAITING for a pooled connection (pool exhaustion
 *                                    is invisible otherwise: the request is simply slow).
 * - `API_SERVER_TIMING=true`         Also expose that breakdown as a `Server-Timing` response header
 *                                    (`total`, `db`, `pool`), readable in the browser's network panel.
 * - `API_SLOW_REQUEST_LOG_MS=<ms>`   Log one line for every request slower than `<ms>`, with its breakdown.
 * - `API_EVENT_LOOP_MONITOR_MS=<ms>` Sample event-loop delay; log when its max in a 10 s window exceeds `<ms>`,
 *                                    together with the database pools' size, idle and waiting counts. A stall
 *                                    that freezes every request shows up here as either a blocked loop (high
 *                                    delay) or a starved pool (waiting > 0 for the whole window).
 *
 * The SQL counters patch the `pg` driver itself (`Client.prototype.query`, `Pool.prototype.connect`), so they
 * cover TypeORM, MikroORM and Knex alike, and anything else that talks to PostgreSQL through `pg`.
 */

export interface RequestPerfStore {
	queries: number;
	queryMs: number;
	poolWaits: number;
	poolWaitMs: number;
}

const storage = new AsyncLocalStorage<RequestPerfStore>();

type PgPool = { totalCount?: number; idleCount?: number; waitingCount?: number; options?: { max?: number } };
const pools = new Set<PgPool>();

function flag(name: string): boolean {
	return String(process.env[name] ?? '').toLowerCase() === 'true';
}

function ms(name: string): number {
	const value = Number.parseInt(String(process.env[name] ?? ''), 10);
	return Number.isFinite(value) && value > 0 ? value : 0;
}

/** Whether any part of the instrumentation is enabled. */
export function isPerfMetricsEnabled(): boolean {
	return flag('API_PERF_METRICS') || flag('API_SERVER_TIMING') || ms('API_SLOW_REQUEST_LOG_MS') > 0;
}

/** The counters of the request running in the current async context, if one is being measured. */
export function currentRequestPerf(): RequestPerfStore | undefined {
	return storage.getStore();
}

let pgPatched = false;

/**
 * Patch the `pg` driver once so that every query and every pool checkout is attributed to the request that
 * caused it. Safe to call when `pg` is not installed (SQLite / Electron builds): it then does nothing.
 */
export function instrumentPg(pgModule?: any): boolean {
	if (pgPatched) return true;
	let pg = pgModule;
	if (!pg) {
		try {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			pg = require('pg');
		} catch {
			return false;
		}
	}
	const Client = pg?.Client;
	const Pool = pg?.Pool;
	if (!Client?.prototype?.query || !Pool?.prototype?.connect) {
		return false;
	}

	const originalQuery = Client.prototype.query;
	Client.prototype.query = function patchedQuery(this: unknown, ...args: any[]) {
		const store = storage.getStore();
		if (!store) {
			return originalQuery.apply(this, args);
		}
		const started = performance.now();
		const done = () => {
			store.queries++;
			store.queryMs += performance.now() - started;
		};
		const last = args[args.length - 1];
		if (typeof last === 'function') {
			args[args.length - 1] = function (this: unknown, ...cbArgs: any[]) {
				done();
				return last.apply(this, cbArgs);
			};
			return originalQuery.apply(this, args);
		}
		// A query object with its own callback (`query({ text, callback })`) or a submittable.
		const first = args[0];
		if (first && typeof first === 'object' && typeof first.callback === 'function') {
			const callback = first.callback;
			first.callback = function (this: unknown, ...cbArgs: any[]) {
				done();
				return callback.apply(this, cbArgs);
			};
			return originalQuery.apply(this, args);
		}
		const result = originalQuery.apply(this, args);
		if (result && typeof result.then === 'function') {
			result.then(done, done);
		} else {
			done();
		}
		return result;
	};

	const originalConnect = Pool.prototype.connect;
	Pool.prototype.connect = function patchedConnect(this: PgPool, ...args: any[]) {
		pools.add(this);
		const store = storage.getStore();
		if (!store) {
			return originalConnect.apply(this, args);
		}
		const started = performance.now();
		const done = () => {
			store.poolWaits++;
			store.poolWaitMs += performance.now() - started;
		};
		const cb = args[0];
		if (typeof cb === 'function') {
			return originalConnect.call(this, function (this: unknown, ...cbArgs: any[]) {
				done();
				return cb.apply(this, cbArgs);
			});
		}
		const result = originalConnect.apply(this, args);
		if (result && typeof result.then === 'function') {
			result.then(done, done);
		}
		return result;
	};

	pgPatched = true;
	return true;
}

/** Size, idle and waiting counts of every `pg` pool seen so far. */
export function pgPoolStats(): Array<{ max?: number; total?: number; idle?: number; waiting?: number }> {
	return [...pools].map((pool) => ({
		max: pool.options?.max,
		total: pool.totalCount,
		idle: pool.idleCount,
		waiting: pool.waitingCount
	}));
}

function round(value: number): number {
	return Math.round(value * 10) / 10;
}

/**
 * The Express middleware that opens a measuring scope for each request. Register it FIRST, so that the time of
 * every other middleware (session store, body parsing, authentication) is inside `total`.
 */
export function createPerfMetricsMiddleware(options: { logger?: { warn: (message: string) => void } } = {}) {
	const serverTiming = flag('API_SERVER_TIMING');
	const slowMs = ms('API_SLOW_REQUEST_LOG_MS');
	const logger = options.logger ?? console;

	return function perfMetricsMiddleware(req: IncomingMessage & { originalUrl?: string }, res: ServerResponse, next: () => void) {
		const store: RequestPerfStore = { queries: 0, queryMs: 0, poolWaits: 0, poolWaitMs: 0 };
		const started = performance.now();

		if (serverTiming) {
			const writeHead = res.writeHead;
			res.writeHead = function patchedWriteHead(this: ServerResponse, ...args: any[]) {
				if (!res.headersSent) {
					const total = performance.now() - started;
					res.setHeader(
						'Server-Timing',
						`total;dur=${round(total)}, db;dur=${round(store.queryMs)};desc="${store.queries} queries", pool;dur=${round(store.poolWaitMs)}`
					);
				}
				return writeHead.apply(this, args as any);
			} as typeof res.writeHead;
		}

		if (slowMs > 0) {
			res.once('finish', () => {
				const total = performance.now() - started;
				if (total >= slowMs) {
					logger.warn(
						`Slow request ${req.method} ${(req.originalUrl ?? req.url ?? '').split('?')[0]} ${res.statusCode} ` +
							`${round(total)}ms (db ${round(store.queryMs)}ms in ${store.queries} queries, ` +
							`pool wait ${round(store.poolWaitMs)}ms)`
					);
				}
			});
		}

		storage.run(store, next);
	};
}

let loopMonitorStarted = false;

/**
 * Sample event-loop delay and report windows in which the loop was blocked or a pool had waiters.
 * Returns a stop function. Does nothing unless `API_EVENT_LOOP_MONITOR_MS` is set.
 */
export function startEventLoopMonitor(options: { logger?: { warn: (message: string) => void }; windowMs?: number } = {}) {
	const thresholdMs = ms('API_EVENT_LOOP_MONITOR_MS');
	if (!thresholdMs || loopMonitorStarted) {
		return () => undefined;
	}
	loopMonitorStarted = true;
	const logger = options.logger ?? console;
	const histogram = monitorEventLoopDelay({ resolution: 20 });
	histogram.enable();
	const timer = setInterval(() => {
		const maxMs = histogram.max / 1e6;
		const p99Ms = histogram.percentile(99) / 1e6;
		const stats = pgPoolStats();
		const starved = stats.some((pool) => (pool.waiting ?? 0) > 0);
		if (maxMs >= thresholdMs || starved) {
			logger.warn(
				`Event loop delay max ${round(maxMs)}ms p99 ${round(p99Ms)}ms; pg pools ${JSON.stringify(stats)}`
			);
		}
		histogram.reset();
	}, options.windowMs ?? 10_000);
	timer.unref();
	return () => {
		clearInterval(timer);
		histogram.disable();
		loopMonitorStarted = false;
	};
}
