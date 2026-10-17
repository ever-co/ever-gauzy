import {
	DEFAULT_SESSION_STORE_TIMEOUT_MS,
	resolveSessionStoreTimeout,
	withSessionStoreDeadline
} from './session-store-deadline';
import { resolveSaveUninitialized } from './redis-store';

jest.mock('redis', () => ({ createClient: jest.fn() }));
jest.mock('connect-redis', () => ({ __esModule: true, RedisStore: jest.fn() }));
jest.mock('@gauzy/config', () => ({
	environment: { production: false, EXPRESS_SESSION_SECRET: 'test-session-secret' }
}));

/**
 * A store whose operations answer after `delayMs` (or never, for `Infinity`).
 */
function slowStore(delayMs: number) {
	const answer = (cb: (err?: unknown, data?: unknown) => void, data?: unknown) => {
		if (delayMs !== Infinity) setTimeout(() => cb(null, data), delayMs);
	};
	return {
		get: jest.fn((_sid: string, cb: any) => answer(cb, { cookie: {}, value: 1 })),
		set: jest.fn((_sid: string, _sess: unknown, cb: any) => answer(cb)),
		touch: jest.fn((_sid: string, _sess: unknown, cb: any) => answer(cb)),
		destroy: jest.fn((_sid: string, cb: any) => answer(cb))
	};
}

const call = (fn: (...args: any[]) => void, ...args: any[]) =>
	new Promise<{ err: unknown; data: unknown }>((resolve) => fn(...args, (err: unknown, data: unknown) => resolve({ err, data })));

describe('withSessionStoreDeadline', () => {
	const logger = { warn: jest.fn() } as any;

	beforeEach(() => logger.warn.mockReset());

	it('passes answers through when the store answers in time', async () => {
		const store = withSessionStoreDeadline(slowStore(1) as any, 200, logger);
		await expect(call(store.get, 'sid')).resolves.toEqual({ err: null, data: { cookie: {}, value: 1 } });
		await expect(call(store.set, 'sid', {})).resolves.toEqual({ err: null, data: undefined });
		expect(logger.warn).not.toHaveBeenCalled();
	});

	it('lets the request continue without a session when the store does not answer', async () => {
		const store = withSessionStoreDeadline(slowStore(Infinity) as any, 20, logger);
		const started = Date.now();
		await expect(call(store.get, 'sid')).resolves.toEqual({ err: null, data: null });
		await expect(call(store.set, 'sid', {})).resolves.toEqual({ err: undefined, data: undefined });
		await expect(call(store.touch, 'sid', {})).resolves.toEqual({ err: undefined, data: undefined });
		await expect(call(store.destroy, 'sid')).resolves.toEqual({ err: undefined, data: undefined });
		expect(Date.now() - started).toBeLessThan(1000);
		// Rate limited: one line for the whole outage, not one per request.
		expect(logger.warn).toHaveBeenCalledTimes(1);
	});

	it('calls back exactly once when the store answers after the deadline', async () => {
		const store = withSessionStoreDeadline(slowStore(40) as any, 10, logger);
		const cb = jest.fn();
		store.get('sid', cb);
		await new Promise((resolve) => setTimeout(resolve, 80));
		expect(cb).toHaveBeenCalledTimes(1);
		expect(cb).toHaveBeenCalledWith(null, null);
	});

	it('leaves the store untouched for a 0 timeout', () => {
		const raw = slowStore(1);
		const get = raw.get;
		expect(withSessionStoreDeadline(raw as any, 0, logger).get).toBe(get);
	});

	it('reads the timeout from the environment', () => {
		expect(resolveSessionStoreTimeout(undefined)).toBe(DEFAULT_SESSION_STORE_TIMEOUT_MS);
		expect(resolveSessionStoreTimeout('abc')).toBe(DEFAULT_SESSION_STORE_TIMEOUT_MS);
		expect(resolveSessionStoreTimeout('500')).toBe(500);
		expect(resolveSessionStoreTimeout('0')).toBe(0);
	});
});

describe('resolveSaveUninitialized', () => {
	it('does not store untouched sessions unless asked to', () => {
		expect(resolveSaveUninitialized(undefined)).toBe(false);
		expect(resolveSaveUninitialized('')).toBe(false);
		expect(resolveSaveUninitialized('false')).toBe(false);
		expect(resolveSaveUninitialized('true')).toBe(true);
		expect(resolveSaveUninitialized(' TRUE ')).toBe(true);
	});
});
