import type { Store } from 'express-session';

/**
 * How long a session store operation may take before the request carries on without it.
 *
 * `express-session` waits for its store on the way IN (loading the session named by the cookie) and on the way
 * OUT (saving or touching it, before the response is written). When the store is Redis and its connection
 * degrades — a failover, a maintenance window, a half-open TCP connection after a network blip — node-redis
 * queues every command until the socket recovers, and with nothing bounding that wait EVERY request of the API
 * hangs at the same moment, then all of them resume together when Redis answers again. A session is only needed
 * by the social sign-in and OAuth flows, so a request whose store did not answer in time continues as if it had
 * no session (on the way in) or as if the write had succeeded (on the way out), and the event is logged.
 */
export const DEFAULT_SESSION_STORE_TIMEOUT_MS = 2000;

export function resolveSessionStoreTimeout(value: string | undefined): number {
	const parsed = Number.parseInt(String(value ?? ''), 10);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_SESSION_STORE_TIMEOUT_MS;
}

type Callback = (err?: unknown, data?: unknown) => void;

/**
 * Bound the `get` / `set` / `touch` / `destroy` operations of an `express-session` store by a deadline.
 * `timeoutMs` 0 leaves the store untouched. Returns the same store instance.
 */
export function withSessionStoreDeadline<T extends Store>(
	store: T,
	timeoutMs: number,
	logger: { warn: (message: string) => void } = console
): T {
	if (!timeoutMs) {
		return store;
	}
	let lastWarning = 0;
	const warn = (operation: string) => {
		const now = Date.now();
		// One line per 10 s at most: during an outage every request would otherwise log.
		if (now - lastWarning > 10_000) {
			lastWarning = now;
			logger.warn(`Session store ${operation} did not answer within ${timeoutMs}ms; the request continues without it.`);
		}
	};

	const wrap = (operation: 'get' | 'set' | 'touch' | 'destroy', onTimeout: (cb: Callback) => void) => {
		const original = (store as any)[operation];
		if (typeof original !== 'function') return;
		(store as any)[operation] = function (this: unknown, ...args: any[]) {
			const cb: Callback | undefined = typeof args[args.length - 1] === 'function' ? args.pop() : undefined;
			if (!cb) {
				return original.apply(store, args);
			}
			let settled = false;
			const timer = setTimeout(() => {
				if (settled) return;
				settled = true;
				warn(operation);
				onTimeout(cb);
			}, timeoutMs);
			timer.unref?.();
			return original.call(store, ...args, (err?: unknown, data?: unknown) => {
				clearTimeout(timer);
				if (settled) return;
				settled = true;
				cb(err, data);
			});
		};
	};

	wrap('get', (cb) => cb(null, null));
	wrap('set', (cb) => cb());
	wrap('touch', (cb) => cb());
	wrap('destroy', (cb) => cb());
	return store;
}
