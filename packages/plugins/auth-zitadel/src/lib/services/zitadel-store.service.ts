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
	set(key: string, value: string, options: { PX: number }): Promise<unknown>;
	getDel(key: string): Promise<string | null>;
	del(key: string): Promise<unknown>;
}

const PREFIX = 'zitadel:';

/** How long a consumed key stays claimed in process memory (only the race between two takes needs it). */
const CLAIM_TTL_MS = 10 * 60 * 1000;

/**
 * Short-lived server-side records: one-time hand-off keys, pending confirmations and pending
 * sign-ups. Nothing personal ever travels in a URL; the browser only carries an opaque random key.
 *
 * With Redis configured, `take()` is an atomic GETDEL, so a key works once across all API replicas
 * (multi-replica deployments must configure Redis). Without Redis the platform's in-memory cache is
 * used and a synchronous in-process claim makes `take()` single-use within the process.
 */
@Injectable()
export class ZitadelStoreService {
	private readonly claimed = new Map<string, number>();

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

	private name(namespace: string, key: string): string {
		return `${PREFIX}${namespace}:${key}`;
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
