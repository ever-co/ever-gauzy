import { HttpException, HttpStatus, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { createClient } from 'redis';
import { environment } from '@gauzy/config';
import { RequestContext } from '../core/context/request-context';
import { EVER_REDIS_CLIENT } from '../redis/redis.module';
import { resolveThrottlerTracker, UNRESOLVED_THROTTLER_TRACKER } from '../throttler/tracker';

type RedisClient = ReturnType<typeof createClient>;

/**
 * The credential family a failure belongs to. Counters are kept per scope so that, for example,
 * fumbling a team join code never locks a user out of password login.
 */
export enum LoginAttemptScope {
	PASSWORD = 'password',
	MAGIC_CODE = 'magic-code',
	TEAM_JOIN_CODE = 'team-join-code'
}

/**
 * Distinct client sources a failure streak must span before it becomes a hard block.
 *
 * The block is keyed on the ACCOUNT, and anyone who knows an email address can submit wrong
 * passwords for it. If failures from a single source were enough, one client could keep any known
 * account locked out of login indefinitely. A single source is already bounded by the per-address
 * route throttle, so the per-account block only has to engage once the guesses demonstrably come
 * from more than one place — which is the distributed attack it exists for.
 */
export const LOGIN_ATTEMPT_MIN_SOURCES = 2;

/**
 * How long an unfinished attempt holds its concurrency slot before it is presumed abandoned.
 *
 * Slots are normally released within milliseconds by {@link LoginAttempt.fail},
 * {@link LoginAttempt.succeed} or {@link LoginAttempt.release}. The expiry only matters for a request
 * that died without doing so, and keeps such a leak from shrinking the account's allowance forever.
 */
export const LOGIN_ATTEMPT_RESERVATION_MS = 30_000;

/**
 * How long one counter operation may wait on Redis before it is served from the in-process store.
 * Same reasoning as the throttler storage: a disconnected node-redis client parks commands rather
 * than rejecting them, and this sits on the login path.
 */
export const LOGIN_ATTEMPT_REDIS_TIMEOUT_MS = 250;

/**
 * Upper bound on accounts tracked by the in-process store, so a spray of distinct emails cannot grow
 * it without limit. The oldest entries are dropped first.
 */
export const LOGIN_ATTEMPT_MEMORY_MAX_ENTRIES = 50_000;

/**
 * One in-flight credential check, returned by {@link LoginAttemptService.begin}.
 *
 * Exactly one of the three methods should be called when the check is over; later calls are
 * ignored, so a `finally` that releases after a `fail()` is harmless.
 */
export interface LoginAttempt {
	/** The credential was wrong: count it against the account. */
	fail(): Promise<void>;
	/** The credential was right: forget the failure streak that preceded it. */
	succeed(): Promise<void>;
	/** The check ended without a verdict on the credential (e.g. an infrastructure error). */
	release(): Promise<void>;
}

/**
 * The attempt handed out when the mechanism is disabled or there is no identifier to count against.
 */
const NOOP_ATTEMPT: LoginAttempt = Object.freeze({
	fail: async () => undefined,
	succeed: async () => undefined,
	release: async () => undefined
});

/**
 * Parameters for recording one failure.
 */
interface FailureInput {
	/** Hashed identity of the client that failed. */
	readonly source: string;
	/** Whether the client could not be attributed to an address at all. */
	readonly unresolvedSource: boolean;
	/** Failures at which the block engages. */
	readonly maxFailures: number;
	/** Block length, and how long a partial streak is remembered, in milliseconds. */
	readonly lockoutMs: number;
}

/**
 * Where the counters live. Every method is atomic with respect to other calls for the same key.
 */
interface LoginAttemptStore {
	/**
	 * Takes a concurrency slot for `token` and reports the account's state.
	 *
	 * @returns The remaining block in milliseconds (0 when not blocked) and the number of slots in
	 * use INCLUDING the one just taken.
	 */
	reserve(key: string, token: string, now: number): Promise<{ blockedMs: number; inFlight: number }>;
	/** Gives back the slot held by `token`. */
	release(key: string, token: string): Promise<void>;
	/** Gives back the slot held by `token` and counts one failure, blocking once the rule is met. */
	recordFailure(key: string, token: string, now: number, input: FailureInput): Promise<void>;
	/** Gives back the slot held by `token` and clears the failure streak. */
	clear(key: string, token: string): Promise<void>;
}

/**
 * Decides whether a streak has earned a hard block.
 *
 * @param failures - Failures in the current streak, including the one just recorded.
 * @param distinctSources - Distinct sources that contributed to the streak.
 * @param input - The failure being recorded.
 * @returns True when the account should be blocked.
 */
function shouldBlock(failures: number, distinctSources: number, input: FailureInput): boolean {
	// A failure that cannot be attributed to any address cannot be shown to come from ONE source,
	// so it must not earn the single-source leniency: the rule fails closed.
	return failures >= input.maxFailures && (distinctSources >= LOGIN_ATTEMPT_MIN_SOURCES || input.unresolvedSource);
}

/**
 * Per-process store. Used when Redis is not configured, and as the fallback when it is unavailable.
 * JavaScript runs each method body to completion between awaits, and these bodies never await, so
 * every operation is atomic within the process.
 */
class MemoryLoginAttemptStore implements LoginAttemptStore {
	private readonly records = new Map<
		string,
		{
			failures: number;
			sources: Set<string>;
			streakExpiresAt: number;
			blockedUntil: number;
			inFlight: Map<string, number>;
		}
	>();

	/**
	 * Returns the live record for `key`, dropping whatever has expired.
	 *
	 * @param key - The account key.
	 * @param now - Current epoch milliseconds.
	 * @returns The record (created on demand).
	 */
	private entry(key: string, now: number) {
		let record = this.records.get(key);

		if (!record) {
			if (this.records.size >= LOGIN_ATTEMPT_MEMORY_MAX_ENTRIES) {
				this.evict(now);
			}
			record = { failures: 0, sources: new Set(), streakExpiresAt: 0, blockedUntil: 0, inFlight: new Map() };
			this.records.set(key, record);
		}

		if (record.streakExpiresAt <= now) {
			record.failures = 0;
			record.sources.clear();
		}
		for (const [token, expiresAt] of record.inFlight) {
			if (expiresAt <= now) {
				record.inFlight.delete(token);
			}
		}

		return record;
	}

	/**
	 * Frees space: first every record with nothing left to remember, then the oldest ones.
	 *
	 * @param now - Current epoch milliseconds.
	 */
	private evict(now: number): void {
		for (const [key, record] of this.records) {
			if (record.streakExpiresAt <= now && record.blockedUntil <= now && record.inFlight.size === 0) {
				this.records.delete(key);
			}
		}
		for (const key of this.records.keys()) {
			if (this.records.size < LOGIN_ATTEMPT_MEMORY_MAX_ENTRIES) {
				break;
			}
			this.records.delete(key);
		}
	}

	async reserve(key: string, token: string, now: number) {
		const record = this.entry(key, now);
		record.inFlight.set(token, now + LOGIN_ATTEMPT_RESERVATION_MS);
		return { blockedMs: Math.max(0, record.blockedUntil - now), inFlight: record.inFlight.size };
	}

	async release(key: string, token: string) {
		this.records.get(key)?.inFlight.delete(token);
	}

	async recordFailure(key: string, token: string, now: number, input: FailureInput) {
		const record = this.entry(key, now);
		record.inFlight.delete(token);

		// A failure that was already in flight when a block landed must not extend that block.
		if (record.blockedUntil > now) {
			return;
		}

		record.failures += 1;
		record.sources.add(input.source);
		record.streakExpiresAt = now + input.lockoutMs;

		if (shouldBlock(record.failures, record.sources.size, input)) {
			record.blockedUntil = now + input.lockoutMs;
			record.failures = 0;
			record.sources.clear();
		}
	}

	async clear(key: string, token: string) {
		const record = this.records.get(key);
		if (record) {
			record.inFlight.delete(token);
			record.failures = 0;
			record.sources.clear();
		}
	}
}

/**
 * Store shared by every API replica. Each operation is one `MULTI`, which Redis executes without
 * interleaving, so replicas cannot lose each other's increments the way a read-modify-write over the
 * application cache did.
 */
class RedisLoginAttemptStore implements LoginAttemptStore {
	constructor(private readonly client: RedisClient) {}

	/**
	 * Key names for one account. The braces are a Redis Cluster hash tag, so every key of one account
	 * lands in the same slot and can share a `MULTI`.
	 *
	 * @param key - The account key.
	 * @returns The four key names.
	 */
	private keys(key: string) {
		return {
			failures: `{${key}}:failures`,
			sources: `{${key}}:sources`,
			inFlight: `{${key}}:inflight`,
			blocked: `{${key}}:blocked`
		};
	}

	async reserve(key: string, token: string, now: number) {
		const keys = this.keys(key);
		const results = await this.client
			.multi()
			.zRemRangeByScore(keys.inFlight, '-inf', now - LOGIN_ATTEMPT_RESERVATION_MS)
			.zAdd(keys.inFlight, { score: now, value: token })
			.pExpire(keys.inFlight, LOGIN_ATTEMPT_RESERVATION_MS)
			.zCard(keys.inFlight)
			.pTTL(keys.blocked)
			.exec();

		return {
			inFlight: Number(results?.[3] ?? 0),
			blockedMs: Math.max(0, Number(results?.[4] ?? -2))
		};
	}

	async release(key: string, token: string) {
		await this.client.zRem(this.keys(key).inFlight, token);
	}

	async recordFailure(key: string, token: string, _now: number, input: FailureInput) {
		const keys = this.keys(key);

		const [, blockTtl] = (await this.client.multi().zRem(keys.inFlight, token).pTTL(keys.blocked).exec()) ?? [];

		// A failure that was already in flight when a block landed must not extend that block.
		if (Number(blockTtl) > 0) {
			return;
		}

		const results = await this.client
			.multi()
			.incr(keys.failures)
			.pExpire(keys.failures, input.lockoutMs)
			.sAdd(keys.sources, input.source)
			.pExpire(keys.sources, input.lockoutMs)
			.sCard(keys.sources)
			.exec();

		if (shouldBlock(Number(results?.[0] ?? 0), Number(results?.[4] ?? 0), input)) {
			// NX: when two replicas cross the threshold together, the first block's expiry stands.
			await this.client
				.multi()
				.set(keys.blocked, '1', { PX: input.lockoutMs, NX: true })
				.del(keys.failures)
				.del(keys.sources)
				.exec();
		}
	}

	async clear(key: string, token: string) {
		const keys = this.keys(key);
		await this.client.multi().zRem(keys.inFlight, token).del(keys.failures).del(keys.sources).exec();
	}
}

/**
 * Identifier-scoped brute-force control.
 *
 * Rate limiting in this API is otherwise keyed on the client address, which bounds how fast ONE
 * client may guess but does nothing about a client that changes address (or, before
 * GHSA-86mw-2crg-vmhc was fixed, merely changed a header) between attempts. This control is keyed on
 * the account identifier instead.
 *
 * Rules, per (scope, account):
 * - Once `AUTH_MAX_FAILED_ATTEMPTS` consecutive failures have come from at least
 *   {@link LOGIN_ATTEMPT_MIN_SOURCES} distinct client sources, the account is blocked for
 *   `AUTH_LOCKOUT_SECONDS` and every attempt gets a 429 with `Retry-After`. Failures from a single
 *   source never block the account — that source is already limited by the route throttle, and
 *   letting it block the account would let anyone lock a known email out of login.
 * - At most `AUTH_MAX_FAILED_ATTEMPTS` checks may be in flight at once, so a burst cannot push
 *   hundreds of concurrent guesses through before the first failures are counted.
 * - A success clears the streak.
 *
 * Residual, by design: an attacker who controls several addresses can still block a known account
 * for `AUTH_LOCKOUT_SECONDS` at a time. That is the price of bounding distributed guessing; operators
 * who would rather rely on the per-address throttle alone set `AUTH_MAX_FAILED_ATTEMPTS=0`.
 *
 * Counters live in Redis (`EVER_REDIS_CLIENT`) when one is configured, so every replica enforces the
 * same numbers, and in the process otherwise. A Redis error or timeout serves that one operation from
 * the in-process store: the control degrades to per-replica counting instead of either failing open
 * or taking authentication down with Redis.
 *
 * Identifiers and client addresses are hashed before they become keys: both are personal data, and
 * keys turn up in Redis monitoring output.
 */
@Injectable()
export class LoginAttemptService {
	private readonly logger = new Logger(LoginAttemptService.name);
	private readonly memory = new MemoryLoginAttemptStore();
	private readonly redis: RedisLoginAttemptStore | null;

	constructor(@Optional() @Inject(EVER_REDIS_CLIENT) private readonly redisClient?: RedisClient | null) {
		this.redis = redisClient ? new RedisLoginAttemptStore(redisClient) : null;
	}

	/**
	 * Failures at which the block engages, and the concurrency cap. `0` disables the whole mechanism.
	 */
	private get maxFailures(): number {
		return environment.AUTH_MAX_FAILED_ATTEMPTS ?? 10;
	}

	/**
	 * How long a blocked identifier stays blocked, and how long a partial failure streak is
	 * remembered, in milliseconds.
	 */
	private get lockoutMs(): number {
		return (environment.AUTH_LOCKOUT_SECONDS ?? 900) * 1000;
	}

	/**
	 * Builds the key for one (scope, identifier) pair.
	 *
	 * Case- and whitespace-insensitive, because `Admin@Ever.co ` and `admin@ever.co` reach the same
	 * account and must therefore share one counter — otherwise the case of the submitted email is a
	 * free bucket-rotation trick of exactly the kind this class exists to prevent.
	 *
	 * @param scope - The credential family.
	 * @param identifier - The account identifier (typically an email address).
	 * @returns The key.
	 */
	private buildKey(scope: LoginAttemptScope, identifier: string): string {
		const normalized = String(identifier ?? '')
			.trim()
			.toLowerCase();
		return `auth:fail:${scope}:${createHash('sha256').update(normalized).digest('hex')}`;
	}

	/**
	 * Identifies the client behind the current request with the same spoof-resistant resolution the
	 * route throttler uses (trusted `CF-Connecting-IP`, otherwise Express's `req.ip`).
	 *
	 * @returns The hashed source, and whether no address could be attributed at all.
	 */
	private currentSource(): { source: string; unresolvedSource: boolean } {
		let tracker = UNRESOLVED_THROTTLER_TRACKER;

		try {
			tracker = resolveThrottlerTracker(RequestContext.currentRequest(), {
				trustCloudflareConnectingIp: environment.THROTTLE_TRUST_CF_CONNECTING_IP === true
			});
		} catch {
			// No request context: stays unresolved, which the blocking rule treats strictly.
		}

		return {
			source: createHash('sha256').update(tracker).digest('hex').slice(0, 32),
			unresolvedSource: tracker === UNRESOLVED_THROTTLER_TRACKER
		};
	}

	/**
	 * Starts a credential check for `identifier`, or rejects it with 429.
	 *
	 * Call this BEFORE any credential verification, and outside any `catch` that rewrites errors
	 * into `UnauthorizedException` — the point is that the caller sees 429, not 401. Then settle the
	 * returned attempt exactly once.
	 *
	 * @param scope - The credential family being attempted.
	 * @param identifier - The account identifier being attempted.
	 * @returns The attempt to settle once the credential has been checked.
	 * @throws HttpException 429 (with a `Retry-After` header) while the identifier is blocked, or
	 * while it already has the maximum number of checks in flight.
	 */
	async begin(scope: LoginAttemptScope, identifier: string): Promise<LoginAttempt> {
		const maxFailures = this.maxFailures;

		if (maxFailures <= 0 || !identifier) {
			return NOOP_ATTEMPT;
		}

		const key = this.buildKey(scope, identifier);
		const token = randomUUID();
		// Attributed now, while this request's context is certainly the current one.
		const source = this.currentSource();
		const { blockedMs, inFlight } = await this.run('reserve', (store) => store.reserve(key, token, Date.now()));

		if (blockedMs > 0 || inFlight > maxFailures) {
			await this.run('release', (store) => store.release(key, token));
			this.reject(blockedMs > 0 ? Math.ceil(blockedMs / 1000) : 1);
		}

		let settled = false;
		const settle = (operation: string, task: (store: LoginAttemptStore) => Promise<void>) => async () => {
			if (settled) {
				return;
			}
			settled = true;
			await this.run(operation, task);
		};

		return {
			fail: settle('recordFailure', (store) =>
				store.recordFailure(key, token, Date.now(), {
					...source,
					maxFailures,
					lockoutMs: this.lockoutMs
				})
			),
			succeed: settle('clear', (store) => store.clear(key, token)),
			release: settle('release', (store) => store.release(key, token))
		};
	}

	/**
	 * Throws the 429, setting `Retry-After` on the response the way `ThrottlerGuard` does for its own
	 * 429, so a client that honours the standard header backs off for the right time.
	 *
	 * @param retryAfter - Seconds until the caller may try again.
	 * @throws HttpException always.
	 */
	private reject(retryAfter: number): never {
		try {
			RequestContext.currentRequest()?.res?.setHeader?.('Retry-After', String(retryAfter));
		} catch {
			// Headers already sent or no HTTP response (e.g. a non-HTTP transport): the body still says it.
		}

		throw new HttpException(
			{
				statusCode: HttpStatus.TOO_MANY_REQUESTS,
				error: 'Too Many Requests',
				message: `Too many failed attempts for this account. Try again in ${Math.ceil(
					retryAfter / 60
				)} minute(s).`,
				retryAfter
			},
			HttpStatus.TOO_MANY_REQUESTS
		);
	}

	/**
	 * Runs one store operation against Redis when configured, and against the in-process store when
	 * Redis is absent, disconnected, failing or slower than {@link LOGIN_ATTEMPT_REDIS_TIMEOUT_MS}.
	 *
	 * @param operation - Name used in the log line.
	 * @param task - The operation.
	 * @returns The operation's result.
	 */
	private async run<T>(operation: string, task: (store: LoginAttemptStore) => Promise<T>): Promise<T> {
		if (this.redis && this.redisClient?.isReady !== false) {
			let timer: NodeJS.Timeout;
			try {
				return await Promise.race([
					task(this.redis),
					new Promise<never>((_, reject) => {
						timer = setTimeout(
							() => reject(new Error(`Redis did not answer within ${LOGIN_ATTEMPT_REDIS_TIMEOUT_MS}ms`)),
							LOGIN_ATTEMPT_REDIS_TIMEOUT_MS
						);
						timer.unref?.();
					})
				]);
			} catch (error) {
				this.logger.error(
					`Login attempt counter unavailable in Redis (${operation}), using in-process store: ${error?.message}`
				);
			} finally {
				clearTimeout(timer);
			}
		}

		return task(this.memory);
	}
}
