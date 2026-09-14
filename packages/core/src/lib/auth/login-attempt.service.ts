import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { createHash } from 'node:crypto';
import { environment } from '@gauzy/config';

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
 * Shape persisted per identifier. `blockedUntil` is an absolute epoch-ms instant so the block
 * survives being read back from a shared cache on a different replica with a different uptime.
 */
interface ILoginAttemptRecord {
	failures: number;
	blockedUntil: number | null;
}

const CACHE_PREFIX = 'auth:fail:';

/**
 * Identifier-scoped brute-force counter.
 *
 * Rate limiting in this API is otherwise keyed on the client address, which bounds how fast ONE
 * client may guess but does nothing about a client that changes address (or, before
 * GHSA-86mw-2crg-vmhc was fixed, merely changed a header) between attempts. This counter is keyed
 * on the account identifier instead, so N failures against one account cost the same whether they
 * arrive from one address or from a botnet.
 *
 * Storage is the application cache (`CACHE_MANAGER`), which is a shared Redis layer whenever
 * `REDIS_ENABLED=true` and a per-process map otherwise — the same substrate the OAuth code store
 * already uses, so no new dependency and no new failure mode.
 *
 * Identifiers are hashed before they become cache keys: emails are personal data and cache keys
 * turn up in Redis monitoring output and in slow-log lines.
 */
@Injectable()
export class LoginAttemptService {
	private readonly logger = new Logger(LoginAttemptService.name);

	constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

	/**
	 * Maximum consecutive failures tolerated before the identifier is blocked. `0` disables the
	 * whole mechanism.
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
	 * Builds the cache key for one (scope, identifier) pair.
	 *
	 * Case- and whitespace-insensitive, because `Admin@Ever.co ` and `admin@ever.co` reach the same
	 * account and must therefore share one counter — otherwise the case of the submitted email is a
	 * free bucket-rotation trick of exactly the kind this class exists to prevent.
	 *
	 * @param scope - The credential family.
	 * @param identifier - The account identifier (typically an email address).
	 * @returns The cache key.
	 */
	private buildKey(scope: LoginAttemptScope, identifier: string): string {
		const normalized = String(identifier ?? '')
			.trim()
			.toLowerCase();
		return `${CACHE_PREFIX}${scope}:${createHash('sha256').update(normalized).digest('hex')}`;
	}

	/**
	 * Rejects the request when the identifier is currently blocked.
	 *
	 * Call this BEFORE any credential verification, and outside any `catch` that rewrites errors
	 * into `UnauthorizedException` — the point is that the caller sees 429, not 401.
	 *
	 * @param scope - The credential family being attempted.
	 * @param identifier - The account identifier being attempted.
	 * @throws HttpException 429 while the identifier is blocked.
	 */
	async assertNotLockedOut(scope: LoginAttemptScope, identifier: string): Promise<void> {
		if (this.maxFailures <= 0 || !identifier) {
			return;
		}

		const record = await this.read(this.buildKey(scope, identifier));

		if (!record?.blockedUntil) {
			return;
		}

		const retryAfterMs = record.blockedUntil - Date.now();

		if (retryAfterMs <= 0) {
			return;
		}

		const retryAfter = Math.ceil(retryAfterMs / 1000);

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
	 * Records one failed attempt, blocking the identifier once the threshold is reached.
	 *
	 * @param scope - The credential family that failed.
	 * @param identifier - The account identifier that failed.
	 */
	async recordFailure(scope: LoginAttemptScope, identifier: string): Promise<void> {
		if (this.maxFailures <= 0 || !identifier) {
			return;
		}

		const key = this.buildKey(scope, identifier);
		const current = await this.read(key);
		const now = Date.now();

		// An expired block starts a fresh streak rather than resuming the old one.
		const carried = current && (!current.blockedUntil || current.blockedUntil > now) ? current.failures : 0;
		const failures = carried + 1;
		const blockedUntil = failures >= this.maxFailures ? now + this.lockoutMs : null;

		await this.write(key, { failures, blockedUntil });
	}

	/**
	 * Clears the counter after a successful authentication, so a user who eventually remembers
	 * their password is not punished for the attempts that preceded it.
	 *
	 * @param scope - The credential family that succeeded.
	 * @param identifier - The account identifier that succeeded.
	 */
	async reset(scope: LoginAttemptScope, identifier: string): Promise<void> {
		if (this.maxFailures <= 0 || !identifier) {
			return;
		}

		try {
			await this.cacheManager.del(this.buildKey(scope, identifier));
		} catch (error) {
			this.logger.warn(`Failed to clear the login attempt counter: ${error?.message}`);
		}
	}

	/**
	 * Reads a counter, tolerating a cache outage.
	 *
	 * Deliberately fail-OPEN, and deliberately narrow: the only thing that becomes unavailable when the
	 * cache is unavailable is this SECONDARY control — the per-address throttle and the password check
	 * itself both still run. Failing closed here would turn a Redis blip into a total
	 * authentication outage across every replica, which is a worse outcome than briefly losing one
	 * of two brute-force defenses. The failure is logged at error level so it is visible.
	 *
	 * @param key - The cache key.
	 * @returns The stored record, or null when absent or unreadable.
	 */
	private async read(key: string): Promise<ILoginAttemptRecord | null> {
		try {
			return (await this.cacheManager.get<ILoginAttemptRecord>(key)) ?? null;
		} catch (error) {
			this.logger.error(`Login attempt counter unavailable (read): ${error?.message}`);
			return null;
		}
	}

	/**
	 * Writes a counter, tolerating a cache outage. The TTL matches the lockout window, so an
	 * abandoned streak evaporates on its own and no cleanup job is needed.
	 *
	 * @param key - The cache key.
	 * @param record - The record to persist.
	 */
	private async write(key: string, record: ILoginAttemptRecord): Promise<void> {
		try {
			await this.cacheManager.set(key, record, this.lockoutMs);
		} catch (error) {
			this.logger.error(`Login attempt counter unavailable (write): ${error?.message}`);
		}
	}
}
