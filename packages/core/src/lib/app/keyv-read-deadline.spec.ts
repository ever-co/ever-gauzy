import { resolveRedisCacheReadTimeout, withKeyvReadDeadline } from './keyv-read-deadline';

const slow = (ms: number, value: unknown) => new Promise((resolve) => setTimeout(() => resolve(value), ms));

describe('withKeyvReadDeadline', () => {
	const logger = { warn: jest.fn() };
	beforeEach(() => logger.warn.mockReset());

	it('returns what the store answers in time', async () => {
		const store = withKeyvReadDeadline<any>(
			{ get: () => slow(1, 'v'), getMany: () => slow(1, ['a', 'b']) },
			100,
			logger
		);
		await expect(store.get('k')).resolves.toBe('v');
		await expect(store.getMany(['x', 'y'])).resolves.toEqual(['a', 'b']);
		expect(logger.warn).not.toHaveBeenCalled();
	});

	it('answers a miss when the store does not answer in time, and warns once', async () => {
		const never = () => new Promise(() => undefined);
		const store = withKeyvReadDeadline<any>(
			{ get: never, getRaw: never, has: never, getMany: never, getManyRaw: never, hasMany: never },
			20,
			logger
		);
		await expect(store.get('k')).resolves.toBeUndefined();
		await expect(store.getRaw('k')).resolves.toBeUndefined();
		await expect(store.has('k')).resolves.toBe(false);
		await expect(store.getMany(['a', 'b'])).resolves.toEqual([undefined, undefined]);
		await expect(store.getManyRaw(['a'])).resolves.toEqual([undefined]);
		await expect(store.hasMany(['a'])).resolves.toEqual([false]);
		expect(logger.warn).toHaveBeenCalledTimes(1);
	});

	it('propagates a rejection like the store would', async () => {
		const store = withKeyvReadDeadline<any>({ get: () => Promise.reject(new Error('down')) }, 50, logger);
		await expect(store.get('k')).rejects.toThrow('down');
	});

	it('leaves writes and a 0 timeout alone', () => {
		const set = jest.fn();
		const get = jest.fn();
		const store = withKeyvReadDeadline<any>({ set, get }, 0, logger);
		expect(store.get).toBe(get);
		expect(withKeyvReadDeadline<any>({ set }, 10, logger).set).toBe(set);
	});

	it('reads REDIS_CACHE_READ_TIMEOUT_MS', () => {
		expect(resolveRedisCacheReadTimeout(undefined)).toBe(250);
		expect(resolveRedisCacheReadTimeout('0')).toBe(0);
		expect(resolveRedisCacheReadTimeout('1000')).toBe(1000);
		expect(resolveRedisCacheReadTimeout('x')).toBe(250);
	});
});
