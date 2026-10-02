import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { EVER_REDIS_CLIENT } from '@gauzy/core';

/** Minimal shape of the platform cache this store uses. */
export interface ZitadelCache {
	get<T>(key: string): Promise<T | undefined | null>;
	set<T>(key: string, value: T, ttl?: number): Promise<unknown>;
	del(key: string): Promise<unknown>;
}

/** Minimal shape of the optional Redis client. */
export interface ZitadelRedis {
	get(key: string): Promise<string | null>;
	/** Answers `OK` when the value was written (with `NX`, only when the key did not exist). */
	set(key: string, value: string, options: { PX: number; NX?: true }): Promise<unknown>;
	getDel(key: string): Promise<string | null>;
	del(key: string): Promise<unknown>;
	exists(key: string): Promise<number>;
	incr(key: string): Promise<number>;
	pExpire(key: string, milliseconds: number): Promise<unknown>;
	pTTL(key: string): Promise<number>;
}

/** The outcome of counting one use of a key ({@link ZitadelStoreService.hit}). */
export interface ZitadelRateResult {
	allowed: boolean;
	/** When refused: seconds until the window ends. */
	retryAfterSeconds: number;
}

const PREFIX = 'zitadel:';

/** How long a consumed key stays claimed in process memory (only the race between two takes needs it). */
const CLAIM_TTL_MS = 10 * 60 * 1000;

/**
 * Longest time one attempt may hold a key. An attempt releases it as soon as it is done; this only
 * bounds how long a key reads as busy when an attempt never finishes (a crashed replica).
 */
export const HOLD_TTL_MS = 30 * 1000;

/**
 * Short-lived server-side records: one-time hand-off keys, pending confirmations and pending
 * sign-ups. Nothing personal ever travels in a URL; the browser only carries an opaque random key.
 *
 * With Redis configured, `take()` is an atomic GETDEL, so a key works once across all API replicas
 * (multi-replica deployments must configure Redis). Without Redis the platform's in-memory cache is
 * used and a synchronous in-process claim makes `take()` single-use within the process.
 *
 * An attempt that may put a record back (a wrong code, a failed step) first holds its key
 * ({@link hold}), so a second attempt with the same key meanwhile learns that the key is busy rather
 * than used up. The store also counts the uses of a key per time window ({@link hit}).
 */
@Injectable()
export class ZitadelStoreService {
	private readonly claimed = new Map<string, number>();
	private readonly holds = new Map<string, number>();
	private readonly counters = new Map<string, { count: number; resetAt: number }>();

	constructor(
		@Inject(CACHE_MANAGER) private readonly cache: ZitadelCache,
		@Optional() @Inject(EVER_REDIS_CLIENT) private readonly redis: ZitadelRedis | null
	) {}

	/** A new opaque key: 32 random bytes, base64url. */
	newKey(): string {
		return randomBytes(32).toString('base64url');
	}

	/** A stable key derived from an identity, so a pending record can be found again when the person returns. */
	identityKey(issuer: string, subject: string): string {
		return createHash('sha256').update(`${issuer}\n${subject}`).digest('base64url');
	}

	async put<T>(namespace: string, key: string, value: T, ttlSeconds: number): Promise<void> {
		const name = this.name(namespace, key);
		const text = JSON.stringify(value);
		const ttlMs = ttlSeconds * 1000;
		this.claimed.delete(name);
		if (this.redis) {
			await this.redis.set(name, text, { PX: ttlMs });
		} else {
			await this.cache.set(name, text, ttlMs);
		}
	}

	/** Reads a record without consuming it. */
	async get<T>(namespace: string, key: string): Promise<T | null> {
		if (!this.isKey(key)) {
			return null;
		}
		const name = this.name(namespace, key);
		if (!this.redis && this.isClaimed(name)) {
			return null;
		}
		const text = this.redis ? await this.redis.get(name) : await this.cache.get<string>(name);
		return this.parse<T>(text);
	}

	/** Reads and deletes a record; a second call for the same key returns `null`. */
	async take<T>(namespace: string, key: string): Promise<T | null> {
		if (!this.isKey(key)) {
			return null;
		}
		const name = this.name(namespace, key);
		if (this.redis) {
			return this.parse<T>(await this.redis.getDel(name));
		}
		if (this.isClaimed(name)) {
			return null;
		}
		// Claimed synchronously, before the first await, so two concurrent calls cannot both succeed.
		this.claimed.set(name, Date.now() + CLAIM_TTL_MS);
		try {
			const text = await this.cache.get<string>(name);
			await this.cache.del(name);
			const value = this.parse<T>(text);
			if (value === null) {
				this.claimed.delete(name);
			}
			return value;
		} catch (error) {
			this.claimed.delete(name);
			throw error;
		}
	}

	async delete(namespace: string, key: string): Promise<void> {
		if (!this.isKey(key)) {
			return;
		}
		const name = this.name(namespace, key);
		if (this.redis) {
			await this.redis.del(name);
		} else {
			await this.cache.del(name);
		}
	}

	/**
	 * Marks a key as held by the current attempt, for at most {@link HOLD_TTL_MS}. Returns `false`
	 * when another attempt holds it. Every successful hold must be ended with {@link release}. The
	 * hold does not replace `take()`, which alone makes a key single-use; it only tells a concurrent
	 * attempt that the key is busy rather than used up.
	 */
	async hold(namespace: string, key: string): Promise<boolean> {
		if (!this.isKey(key)) {
			// Nothing to hold: a malformed key is never looked up.
			return true;
		}
		const name = this.holdName(namespace, key);
		if (this.redis) {
			return (await this.redis.set(name, '1', { PX: HOLD_TTL_MS, NX: true })) === 'OK';
		}
		// Checked and set synchronously, so two concurrent calls cannot both hold the key.
		if (this.isHeldInMemory(name)) {
			return false;
		}
		this.holds.set(name, Date.now() + HOLD_TTL_MS);
		return true;
	}

	/** Ends a hold taken with {@link hold}. */
	async release(namespace: string, key: string): Promise<void> {
		if (!this.isKey(key)) {
			return;
		}
		const name = this.holdName(namespace, key);
		if (this.redis) {
			await this.redis.del(name);
		} else {
			this.holds.delete(name);
		}
	}

	/** Whether an attempt holds the key right now. */
	async isHeld(namespace: string, key: string): Promise<boolean> {
		if (!this.isKey(key)) {
			return false;
		}
		const name = this.holdName(namespace, key);
		return this.redis ? (await this.redis.exists(name)) > 0 : this.isHeldInMemory(name);
	}

	/**
	 * Counts one use of `key` in a fixed window of `windowMs` and tells whether it is within `limit`.
	 * Counters are kept under a digest of the key, never the key itself; in Redis when configured
	 * (shared by every replica), in process memory otherwise.
	 */
	async hit(bucket: string, key: string, limit: number, windowMs: number): Promise<ZitadelRateResult> {
		const name = `${PREFIX}rate:${bucket}:${createHash('sha256').update(key).digest('base64url')}`;
		if (this.redis) {
			const count = await this.redis.incr(name);
			if (count === 1) {
				await this.redis.pExpire(name, windowMs);
			}
			if (count <= limit) {
				return { allowed: true, retryAfterSeconds: 0 };
			}
			let remainingMs = await this.redis.pTTL(name);
			if (remainingMs < 0) {
				// The window lost its expiry (a replica stopped between the two commands): start it again.
				await this.redis.pExpire(name, windowMs);
				remainingMs = windowMs;
			}
			return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / 1000)) };
		}

		const now = Date.now();
		this.pruneCounters(now);
		let counter = this.counters.get(name);
		if (!counter || counter.resetAt <= now) {
			counter = { count: 0, resetAt: now + windowMs };
			// Re-inserted, so the map stays ordered by the end of each window (see pruneCounters).
			this.counters.delete(name);
			this.counters.set(name, counter);
		}
		counter.count += 1;
		if (counter.count <= limit) {
			return { allowed: true, retryAfterSeconds: 0 };
		}
		return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((counter.resetAt - now) / 1000)) };
	}

	private name(namespace: string, key: string): string {
		return `${PREFIX}${namespace}:${key}`;
	}

	private holdName(namespace: string, key: string): string {
		return `${PREFIX}hold:${namespace}:${key}`;
	}

	/** Keys are base64url text of a bounded length; anything else is never looked up. */
	private isKey(key: unknown): key is string {
		return typeof key === 'string' && key.length >= 16 && key.length <= 128 && /^[A-Za-z0-9_-]+$/.test(key);
	}

	private isClaimed(name: string): boolean {
		const now = Date.now();
		for (const [claimedName, expiresAt] of this.claimed) {
			if (expiresAt > now) {
				break;
			}
			this.claimed.delete(claimedName);
		}
		return this.claimed.has(name);
	}

	private isHeldInMemory(name: string): boolean {
		const expiresAt = this.holds.get(name);
		if (expiresAt === undefined) {
			return false;
		}
		if (expiresAt <= Date.now()) {
			this.holds.delete(name);
			return false;
		}
		return true;
	}

	/** Drops expired windows (oldest first; windows of one route share a length). */
	private pruneCounters(now: number): void {
		for (const [name, counter] of this.counters) {
			if (counter.resetAt > now) {
				break;
			}
			this.counters.delete(name);
		}
	}

	private parse<T>(text: string | null | undefined): T | null {
		if (!text) {
			return null;
		}
		try {
			return JSON.parse(text) as T;
		} catch {
			return null;
		}
	}
}
