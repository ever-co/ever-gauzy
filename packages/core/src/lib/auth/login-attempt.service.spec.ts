import { HttpStatus } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { environment } from '@gauzy/config';
import { LoginAttemptScope, LoginAttemptService } from './login-attempt.service';

/**
 * Regression suite for the missing per-ACCOUNT brute-force control (GHSA-86mw-2crg-vmhc).
 *
 * Route-level `@Throttle` counts against the client address. Nothing counted against the account,
 * so an attacker who changed address (or, before the tracker fix, merely changed a header) between
 * attempts had an unlimited budget against a single known email. These tests deliberately never
 * mention an IP: every failure below is modelled as arriving from a different one.
 */
describe('LoginAttemptService', () => {
	const EMAIL = 'victim@ever.co';

	let store: Map<string, unknown>;
	let cache: Cache;
	let service: LoginAttemptService;

	const originalMax = environment.AUTH_MAX_FAILED_ATTEMPTS;
	const originalLockout = environment.AUTH_LOCKOUT_SECONDS;

	beforeEach(() => {
		store = new Map();
		cache = {
			get: jest.fn(async (key: string) => (store.has(key) ? store.get(key) : null)),
			set: jest.fn(async (key: string, value: unknown) => {
				store.set(key, value);
				return value;
			}),
			del: jest.fn(async (key: string) => {
				store.delete(key);
				return true;
			})
		} as unknown as Cache;

		environment.AUTH_MAX_FAILED_ATTEMPTS = 5;
		environment.AUTH_LOCKOUT_SECONDS = 900;

		service = new LoginAttemptService(cache);
	});

	afterEach(() => {
		environment.AUTH_MAX_FAILED_ATTEMPTS = originalMax;
		environment.AUTH_LOCKOUT_SECONDS = originalLockout;
		jest.restoreAllMocks();
	});

	/** Runs `assertNotLockedOut` and reports the thrown status, or null when it allowed the attempt. */
	const attempt = async (email = EMAIL, scope = LoginAttemptScope.PASSWORD): Promise<number | null> => {
		try {
			await service.assertNotLockedOut(scope, email);
			return null;
		} catch (error) {
			return error?.getStatus?.() ?? -1;
		}
	};

	it('blocks the account once the threshold is reached, no matter where the failures came from', async () => {
		for (let i = 0; i < 4; i++) {
			expect(await attempt()).toBeNull();
			await service.recordFailure(LoginAttemptScope.PASSWORD, EMAIL);
		}

		// Fifth attempt is still allowed to be TRIED; it is the fifth failure that trips the block.
		expect(await attempt()).toBeNull();
		await service.recordFailure(LoginAttemptScope.PASSWORD, EMAIL);

		expect(await attempt()).toBe(HttpStatus.TOO_MANY_REQUESTS);
	});

	it('reports how long the caller must wait', async () => {
		for (let i = 0; i < 5; i++) {
			await service.recordFailure(LoginAttemptScope.PASSWORD, EMAIL);
		}

		expect.assertions(4);

		try {
			await service.assertNotLockedOut(LoginAttemptScope.PASSWORD, EMAIL);
		} catch (error) {
			const body = error.getResponse();
			expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
			expect(body.statusCode).toBe(HttpStatus.TOO_MANY_REQUESTS);
			expect(body.retryAfter).toBeGreaterThan(0);
			expect(body.retryAfter).toBeLessThanOrEqual(900);
		}
	});

	it('treats the identifier case- and whitespace-insensitively', async () => {
		for (let i = 0; i < 5; i++) {
			await service.recordFailure(LoginAttemptScope.PASSWORD, 'Victim@Ever.co');
		}

		// Re-casing the submitted email must not buy a fresh allowance.
		expect(await attempt('victim@ever.co')).toBe(HttpStatus.TOO_MANY_REQUESTS);
		expect(await attempt('  VICTIM@EVER.CO  ')).toBe(HttpStatus.TOO_MANY_REQUESTS);
	});

	it('keeps counters separate per account and per credential family', async () => {
		for (let i = 0; i < 5; i++) {
			await service.recordFailure(LoginAttemptScope.PASSWORD, EMAIL);
		}

		expect(await attempt(EMAIL, LoginAttemptScope.PASSWORD)).toBe(HttpStatus.TOO_MANY_REQUESTS);
		expect(await attempt('someone.else@ever.co', LoginAttemptScope.PASSWORD)).toBeNull();
		expect(await attempt(EMAIL, LoginAttemptScope.MAGIC_CODE)).toBeNull();
	});

	it('clears the streak on a successful authentication', async () => {
		for (let i = 0; i < 4; i++) {
			await service.recordFailure(LoginAttemptScope.PASSWORD, EMAIL);
		}

		await service.reset(LoginAttemptScope.PASSWORD, EMAIL);

		for (let i = 0; i < 4; i++) {
			await service.recordFailure(LoginAttemptScope.PASSWORD, EMAIL);
			expect(await attempt()).toBeNull();
		}
	});

	it('lets the block lapse', async () => {
		for (let i = 0; i < 5; i++) {
			await service.recordFailure(LoginAttemptScope.PASSWORD, EMAIL);
		}
		expect(await attempt()).toBe(HttpStatus.TOO_MANY_REQUESTS);

		const past = Date.now() + 901_000;
		jest.spyOn(Date, 'now').mockReturnValue(past);

		expect(await attempt()).toBeNull();
	});

	it('hashes the identifier instead of putting the email in the cache key', async () => {
		await service.recordFailure(LoginAttemptScope.PASSWORD, EMAIL);

		const [key] = [...store.keys()];
		expect(key).toMatch(/^auth:fail:password:[0-9a-f]{64}$/);
		expect(key).not.toContain(EMAIL);
	});

	it('can be turned off entirely', async () => {
		environment.AUTH_MAX_FAILED_ATTEMPTS = 0;

		for (let i = 0; i < 50; i++) {
			await service.recordFailure(LoginAttemptScope.PASSWORD, EMAIL);
		}

		expect(await attempt()).toBeNull();
		expect(store.size).toBe(0);
	});

	it('does not take authentication down when the cache is unavailable', async () => {
		// The counter is a SECOND line of defense behind the per-address throttle and the password
		// check; a Redis blip must degrade it, not deny every login on every replica.
		(cache.get as jest.Mock).mockRejectedValue(new Error('redis down'));
		(cache.set as jest.Mock).mockRejectedValue(new Error('redis down'));
		jest.spyOn(console, 'error').mockImplementation(() => undefined);

		await expect(service.recordFailure(LoginAttemptScope.PASSWORD, EMAIL)).resolves.toBeUndefined();
		await expect(service.assertNotLockedOut(LoginAttemptScope.PASSWORD, EMAIL)).resolves.toBeUndefined();
	});

	it('ignores an empty identifier rather than pooling every anonymous failure into one lockout', async () => {
		for (let i = 0; i < 20; i++) {
			await service.recordFailure(LoginAttemptScope.PASSWORD, '');
		}

		expect(await attempt('')).toBeNull();
		expect(store.size).toBe(0);
	});
});
