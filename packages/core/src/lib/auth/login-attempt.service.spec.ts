import { HttpException, HttpStatus } from '@nestjs/common';
import { environment } from '@gauzy/config';
import { RequestContext } from '../core/context/request-context';
import {
	LOGIN_ATTEMPT_RESERVATION_MS,
	LoginAttempt,
	LoginAttemptScope,
	LoginAttemptService
} from './login-attempt.service';

/**
 * Regression suite for the per-ACCOUNT brute-force control (GHSA-86mw-2crg-vmhc).
 *
 * Route-level `@Throttle` counts against the client address, so an attacker who changed address
 * between attempts had an unlimited budget against a single known email. The per-account control
 * closes that — without turning into a lever that lets ANY single client lock a known account out of
 * login, and without letting a concurrent burst or a second replica walk past the threshold.
 */
describe('LoginAttemptService', () => {
	const EMAIL = 'victim@ever.co';
	const MAX = 5;

	const originalMax = environment.AUTH_MAX_FAILED_ATTEMPTS;
	const originalLockout = environment.AUTH_LOCKOUT_SECONDS;
	const originalTrustCf = environment.THROTTLE_TRUST_CF_CONNECTING_IP;

	/** The request the service sees as "current"; `null` means no request context at all. */
	let currentRequest: Record<string, any> | null;
	let now: number;

	beforeEach(() => {
		environment.AUTH_MAX_FAILED_ATTEMPTS = MAX;
		environment.AUTH_LOCKOUT_SECONDS = 900;
		environment.THROTTLE_TRUST_CF_CONNECTING_IP = false;

		now = Date.UTC(2026, 8, 17, 12, 0, 0);
		jest.spyOn(Date, 'now').mockImplementation(() => now);

		currentRequest = null;
		jest.spyOn(RequestContext, 'currentRequest').mockImplementation(() => currentRequest);
	});

	afterEach(() => {
		environment.AUTH_MAX_FAILED_ATTEMPTS = originalMax;
		environment.AUTH_LOCKOUT_SECONDS = originalLockout;
		environment.THROTTLE_TRUST_CF_CONNECTING_IP = originalTrustCf;
		jest.restoreAllMocks();
	});

	/** Makes subsequent calls appear to come from `ip`, with a response that records headers. */
	const from = (ip: string) => {
		const headers: Record<string, string> = {};
		currentRequest = {
			ip,
			headers: {},
			res: { setHeader: (name: string, value: string) => (headers[name] = value) }
		};
		return headers;
	};

	/** Starts an attempt and reports the thrown status, or the attempt when it was allowed. */
	const begin = async (
		service: LoginAttemptService,
		email = EMAIL,
		scope = LoginAttemptScope.PASSWORD
	): Promise<LoginAttempt | number> => {
		try {
			return await service.begin(scope, email);
		} catch (error) {
			return error instanceof HttpException ? error.getStatus() : -1;
		}
	};

	/** One complete wrong guess from `ip`. */
	const failFrom = async (service: LoginAttemptService, ip: string, email = EMAIL) => {
		from(ip);
		const attempt = await begin(service, email);
		if (typeof attempt === 'number') {
			return attempt;
		}
		await attempt.fail();
		return null;
	};

	describe.each([
		['in-process store', () => new LoginAttemptService(null)],
		['Redis store', () => new LoginAttemptService(fakeRedis().client as any)]
	])('%s', (_label, create) => {
		let service: LoginAttemptService;

		beforeEach(() => {
			service = create();
		});

		it('blocks the account once the threshold is reached by guesses from different addresses', async () => {
			for (let i = 0; i < MAX; i++) {
				expect(await failFrom(service, `198.51.100.${i}`)).toBeNull();
			}

			from('203.0.113.99');
			expect(await begin(service)).toBe(HttpStatus.TOO_MANY_REQUESTS);
		});

		it('does NOT let a single source lock a known account out of login', async () => {
			// Far past the threshold, all from one address: that address is the route throttle's job.
			for (let i = 0; i < MAX * 10; i++) {
				expect(await failFrom(service, '198.51.100.1')).toBeNull();
			}

			// The real owner, from their own address, still gets to try their password.
			from('203.0.113.7');
			const attempt = await begin(service);
			expect(typeof attempt).toBe('object');
		});

		it('fails closed when failures cannot be attributed to any address', async () => {
			for (let i = 0; i < MAX; i++) {
				currentRequest = null;
				const attempt = await begin(service);
				expect(typeof attempt).toBe('object');
				await (attempt as LoginAttempt).fail();
			}

			expect(await begin(service)).toBe(HttpStatus.TOO_MANY_REQUESTS);
		});

		it('sets Retry-After on the 429 and reports the wait in the body', async () => {
			for (let i = 0; i < MAX; i++) {
				await failFrom(service, `198.51.100.${i}`);
			}

			const headers = from('203.0.113.99');
			now += 60_000;

			await expect(service.begin(LoginAttemptScope.PASSWORD, EMAIL)).rejects.toMatchObject({
				response: expect.objectContaining({ statusCode: HttpStatus.TOO_MANY_REQUESTS, retryAfter: 840 })
			});
			expect(headers['Retry-After']).toBe('840');
		});

		it('caps concurrent checks, so a burst cannot outrun the counter', async () => {
			const inFlight: LoginAttempt[] = [];
			for (let i = 0; i < MAX; i++) {
				from(`198.51.100.${i}`);
				inFlight.push((await begin(service)) as LoginAttempt);
			}

			from('198.51.100.200');
			expect(await begin(service)).toBe(HttpStatus.TOO_MANY_REQUESTS);

			// Every one of the burst turns out wrong: the block lands, and nothing else got through.
			for (const attempt of inFlight) {
				await attempt.fail();
			}
			expect(await begin(service)).toBe(HttpStatus.TOO_MANY_REQUESTS);
		});

		it('frees a slot that was never settled once the reservation expires', async () => {
			for (let i = 0; i < MAX; i++) {
				from(`198.51.100.${i}`);
				await begin(service);
			}
			expect(await begin(service)).toBe(HttpStatus.TOO_MANY_REQUESTS);

			now += LOGIN_ATTEMPT_RESERVATION_MS + 1;
			expect(typeof (await begin(service))).toBe('object');
		});

		it('clears the streak on success', async () => {
			for (let i = 0; i < MAX - 1; i++) {
				await failFrom(service, `198.51.100.${i}`);
			}

			from('203.0.113.7');
			await ((await begin(service)) as LoginAttempt).succeed();

			for (let i = 0; i < MAX - 1; i++) {
				expect(await failFrom(service, `198.51.100.${i}`)).toBeNull();
			}
			expect(typeof (await begin(service))).toBe('object');
		});

		it('does not count an attempt that ended without a verdict', async () => {
			for (let i = 0; i < MAX * 2; i++) {
				from(`198.51.100.${i}`);
				await ((await begin(service)) as LoginAttempt).release();
			}

			expect(typeof (await begin(service))).toBe('object');
		});

		it('does not let failures that were in flight when the block landed count against the next window', async () => {
			for (let i = 0; i < MAX - 1; i++) {
				await failFrom(service, `198.51.100.${i}`);
			}

			// Guesses already past the check when the block lands...
			const late: LoginAttempt[] = [];
			for (let i = 0; i < MAX - 1; i++) {
				from(`198.51.100.${50 + i}`);
				late.push((await begin(service)) as LoginAttempt);
			}
			await failFrom(service, '198.51.100.99'); // ...this one lands the block

			now += 600_000;
			for (const attempt of late) {
				await attempt.fail();
			}

			// Once the ORIGINAL block expires the account starts clean: the late failures neither pushed
			// the block out nor pre-loaded the next streak.
			now += 300_001;
			for (let i = 0; i < MAX - 1; i++) {
				expect(await failFrom(service, `198.51.100.${i}`)).toBeNull();
			}
			expect(typeof (await begin(service))).toBe('object');
		});

		it('starts a fresh streak once a block has expired', async () => {
			for (let i = 0; i < MAX; i++) {
				await failFrom(service, `198.51.100.${i}`);
			}

			now += 900_001;

			for (let i = 0; i < MAX - 1; i++) {
				expect(await failFrom(service, `198.51.100.${i}`)).toBeNull();
			}
			expect(typeof (await begin(service))).toBe('object');
		});

		it('shares one counter across differently-cased spellings of the same email', async () => {
			const spellings = [
				'Victim@Ever.co',
				' victim@ever.co ',
				'VICTIM@EVER.CO',
				'victim@EVER.co',
				'vIcTiM@ever.co'
			];

			for (let i = 0; i < spellings.length; i++) {
				await failFrom(service, `198.51.100.${i}`, spellings[i]);
			}

			expect(await begin(service, EMAIL)).toBe(HttpStatus.TOO_MANY_REQUESTS);
		});

		it('keeps scopes and accounts independent', async () => {
			for (let i = 0; i < MAX; i++) {
				await failFrom(service, `198.51.100.${i}`);
			}

			expect(typeof (await begin(service, EMAIL, LoginAttemptScope.MAGIC_CODE))).toBe('object');
			expect(typeof (await begin(service, 'someone-else@ever.co'))).toBe('object');
		});

		it('is switched off entirely by AUTH_MAX_FAILED_ATTEMPTS=0', async () => {
			environment.AUTH_MAX_FAILED_ATTEMPTS = 0;

			for (let i = 0; i < 50; i++) {
				expect(await failFrom(service, `198.51.100.${i}`)).toBeNull();
			}
		});

		it('ignores a second settlement of the same attempt', async () => {
			from('198.51.100.1');
			const attempt = (await begin(service)) as LoginAttempt;
			await attempt.fail();
			await attempt.fail();
			await attempt.release();

			for (let i = 2; i < MAX; i++) {
				expect(await failFrom(service, `198.51.100.${i}`)).toBeNull();
			}
			// Four real failures so far, not five.
			expect(typeof (await begin(service))).toBe('object');
		});
	});

	describe('with Redis', () => {
		it('enforces one count across replicas', async () => {
			const redis = fakeRedis();
			const replicaA = new LoginAttemptService(redis.client as any);
			const replicaB = new LoginAttemptService(redis.client as any);

			for (let i = 0; i < MAX; i++) {
				await failFrom(i % 2 ? replicaA : replicaB, `198.51.100.${i}`);
			}

			from('203.0.113.99');
			expect(await begin(replicaA)).toBe(HttpStatus.TOO_MANY_REQUESTS);
			expect(await begin(replicaB)).toBe(HttpStatus.TOO_MANY_REQUESTS);
		});

		it('never issues commands on a disconnected client, and still counts in-process', async () => {
			const redis = fakeRedis();
			redis.client.isReady = false;
			const service = new LoginAttemptService(redis.client as any);

			for (let i = 0; i < MAX; i++) {
				await failFrom(service, `198.51.100.${i}`);
			}

			expect(redis.client.multi).not.toHaveBeenCalled();
			expect(await begin(service)).toBe(HttpStatus.TOO_MANY_REQUESTS);
		});

		it('falls back to the in-process store when Redis errors, rather than failing open', async () => {
			const redis = fakeRedis();
			redis.client.multi.mockImplementation(() => {
				throw new Error('connection lost');
			});
			redis.client.zRem.mockRejectedValue(new Error('connection lost'));
			const service = new LoginAttemptService(redis.client as any);
			jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);

			for (let i = 0; i < MAX; i++) {
				await failFrom(service, `198.51.100.${i}`);
			}

			expect(await begin(service)).toBe(HttpStatus.TOO_MANY_REQUESTS);
		});

		it('does not hang the login path when Redis never answers', async () => {
			jest.spyOn(Date, 'now').mockRestore();
			const client = {
				isReady: true,
				multi: () => {
					const chain: Record<string, unknown> = {};
					for (const name of ['zRemRangeByScore', 'zAdd', 'pExpire', 'zCard', 'pTTL']) {
						chain[name] = () => chain;
					}
					chain.exec = () => new Promise(() => undefined);
					return chain;
				},
				zRem: () => new Promise(() => undefined)
			};
			const service = new LoginAttemptService(client as any);
			jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);

			from('198.51.100.1');
			const started = Date.now();
			const attempt = await service.begin(LoginAttemptScope.PASSWORD, EMAIL);
			await attempt.release();

			expect(Date.now() - started).toBeLessThan(5_000);
		});
	});
});

/**
 * In-memory stand-in for the node-redis commands the Redis store uses. `MULTI` runs its queue in one
 * synchronous step, as Redis runs a transaction without interleaving, and time comes from `Date.now`
 * so the suite's clock drives expiry.
 */
function fakeRedis() {
	const strings = new Map<string, number>();
	const sets = new Map<string, Set<string>>();
	const sortedSets = new Map<string, Map<string, number>>();
	const expiries = new Map<string, number>();

	const exists = (key: string) => strings.has(key) || sets.has(key) || sortedSets.has(key);
	const purge = (key: string) => {
		const at = expiries.get(key);
		if (at !== undefined && at <= Date.now()) {
			strings.delete(key);
			sets.delete(key);
			sortedSets.delete(key);
			expiries.delete(key);
		}
	};
	const del = (key: string) => {
		const had = exists(key);
		strings.delete(key);
		sets.delete(key);
		sortedSets.delete(key);
		expiries.delete(key);
		return had ? 1 : 0;
	};

	const commands = {
		zRemRangeByScore: (key: string, _min: string, max: number) => {
			purge(key);
			const sortedSet = sortedSets.get(key);
			let removed = 0;
			for (const [member, score] of sortedSet ?? []) {
				if (score <= max) {
					sortedSet.delete(member);
					removed++;
				}
			}
			return removed;
		},
		zAdd: (key: string, entry: { score: number; value: string }) => {
			purge(key);
			const sortedSet = sortedSets.get(key) ?? new Map<string, number>();
			sortedSets.set(key, sortedSet);
			sortedSet.set(entry.value, entry.score);
			return 1;
		},
		zCard: (key: string) => {
			purge(key);
			return sortedSets.get(key)?.size ?? 0;
		},
		zRem: (key: string, member: string) => {
			purge(key);
			return sortedSets.get(key)?.delete(member) ? 1 : 0;
		},
		pExpire: (key: string, ms: number) => {
			purge(key);
			if (!exists(key)) return false;
			expiries.set(key, Date.now() + ms);
			return true;
		},
		pTTL: (key: string) => {
			purge(key);
			if (!exists(key)) return -2;
			const at = expiries.get(key);
			return at === undefined ? -1 : at - Date.now();
		},
		incr: (key: string) => {
			purge(key);
			const next = (strings.get(key) ?? 0) + 1;
			strings.set(key, next);
			return next;
		},
		sAdd: (key: string, member: string) => {
			purge(key);
			const set = sets.get(key) ?? new Set<string>();
			sets.set(key, set);
			const had = set.has(member);
			set.add(member);
			return had ? 0 : 1;
		},
		sCard: (key: string) => {
			purge(key);
			return sets.get(key)?.size ?? 0;
		},
		set: (key: string, _value: string, options: { PX: number; NX?: boolean }) => {
			purge(key);
			if (options.NX && exists(key)) return null;
			strings.set(key, 1);
			expiries.set(key, Date.now() + options.PX);
			return 'OK';
		},
		del
	};

	const client = {
		isReady: true as boolean,
		zRem: jest.fn(async (key: string, member: string) => commands.zRem(key, member)),
		multi: jest.fn(() => {
			const queue: Array<() => unknown> = [];
			const chain: Record<string, any> = {
				exec: async () => queue.map((run) => run())
			};
			for (const [name, command] of Object.entries(commands)) {
				chain[name] = (...args: unknown[]) => {
					queue.push(() => (command as (...a: unknown[]) => unknown)(...args));
					return chain;
				};
			}
			return chain;
		})
	};

	return { client };
}
