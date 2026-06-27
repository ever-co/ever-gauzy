import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { randomBytes } from 'crypto';
import { ID } from '@gauzy/contracts';
import { EVER_REDIS_CLIENT } from '@gauzy/core';

/**
 * Server-side state recorded when a GitHub App installation flow is initiated by an authenticated
 * tenant. The opaque `state` nonce is handed to GitHub and echoed back on the post-install
 * callback, letting us bind the resulting installation to the tenant/organization that actually
 * started the flow — instead of trusting client-supplied identifiers (cross-tenant installation
 * hijack, GHSA-4rwq-65wh-45h4).
 */
export interface IGithubOAuthState {
	tenantId: ID;
	organizationId: ID;
	userId?: ID;
}

/**
 * Minimal slice of the (node-redis) client we use for ATOMIC single-use nonce operations. The raw
 * client is provided globally as EVER_REDIS_CLIENT (null when REDIS_ENABLED!='true').
 */
interface IRedisAtomicClient {
	get(key: string): Promise<string | null>;
	getDel(key: string): Promise<string | null>;
	set(key: string, value: string, options: { PX: number }): Promise<unknown>;
}

@Injectable()
export class GithubOAuthStateService {
	private readonly logger = new Logger(GithubOAuthStateService.name);

	/** Cache key prefix for pending GitHub install state nonces. */
	private static readonly CACHE_PREFIX = 'github_oauth_state:';
	/** Single-use nonce lifetime: long enough to complete the GitHub install, short enough to limit replay. */
	private static readonly TTL_MS = 10 * 60 * 1000; // 10 minutes
	/** Minted nonces are 32 random bytes rendered as lowercase hex (64 chars). */
	private static readonly NONCE_PATTERN = /^[a-f0-9]{64}$/;
	/** In-process guard for the non-Redis fallback so concurrent consumes can't both resolve a nonce. */
	private static readonly inFlightConsume = new Set<string>();

	constructor(
		@Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
		// Optional raw Redis client for atomic GETDEL (single-use), mirroring AuthService. Null when
		// Redis is disabled — then we fall back to the (global, possibly multi-layer) cache manager.
		@Optional() @Inject(EVER_REDIS_CLIENT) private readonly redisClient: IRedisAtomicClient | null
	) {}

	/** Build the namespaced cache key for a nonce. */
	private key(nonce: string): string {
		return `${GithubOAuthStateService.CACHE_PREFIX}${nonce}`;
	}

	/** Reject anything that is not a well-formed minted nonce (cache-key / log hygiene). */
	private isValidNonce(nonce?: string): nonce is string {
		return !!nonce && GithubOAuthStateService.NONCE_PATTERN.test(nonce);
	}

	/**
	 * Mint a cryptographically-random, single-use state nonce and persist the initiating
	 * tenant/organization (and user) against it.
	 *
	 * @param state The tenant/organization (and optional user) that initiated the install flow.
	 * @returns The opaque nonce to pass to GitHub as the `state` query parameter.
	 */
	async create(state: IGithubOAuthState): Promise<string> {
		const nonce = randomBytes(32).toString('hex');
		const value = JSON.stringify(state);
		const cacheKey = this.key(nonce);
		if (this.redisClient) {
			// Authoritative, cross-replica store with TTL (matches the AuthService OAuth pattern).
			await this.redisClient.set(cacheKey, value, { PX: GithubOAuthStateService.TTL_MS });
		} else {
			await this.cacheManager.set(cacheKey, value, GithubOAuthStateService.TTL_MS);
		}
		return nonce;
	}

	/**
	 * Resolve the tenant/organization bound to a nonce WITHOUT invalidating it. Used by the public
	 * post-install callback to reject forged callbacks (and to avoid using `state` as a redirect
	 * target) while leaving the nonce to be consumed when the installation is finalized.
	 *
	 * @returns The bound state, or `null` for an unknown, malformed or expired nonce.
	 */
	async peek(nonce?: string): Promise<IGithubOAuthState | null> {
		if (!this.isValidNonce(nonce)) {
			return null;
		}
		const cacheKey = this.key(nonce);
		const value = this.redisClient
			? await this.redisClient.get(cacheKey)
			: (await this.cacheManager.get<string>(cacheKey)) ?? null;
		return this.deserialize(value);
	}

	/**
	 * Atomically resolve and invalidate a nonce so it binds at most one installation (single-use).
	 *
	 * @returns The bound state, or `null` for an unknown, malformed or expired nonce.
	 */
	async consume(nonce?: string): Promise<IGithubOAuthState | null> {
		if (!this.isValidNonce(nonce)) {
			return null;
		}
		const cacheKey = this.key(nonce);
		if (this.redisClient) {
			// Atomic single-use: GETDEL guarantees exactly one caller resolves a given nonce, even
			// across replicas, so a replay cannot reuse it (matches AuthService single-use OAuth codes).
			return this.deserialize(await this.redisClient.getDel(cacheKey));
		}
		// Non-Redis fallback (single-node dev): the get+del is not atomic, so guard it with an
		// in-process lock — a second concurrent consume of the same nonce returns null (single-use).
		if (GithubOAuthStateService.inFlightConsume.has(cacheKey)) {
			return null;
		}
		GithubOAuthStateService.inFlightConsume.add(cacheKey);
		try {
			const value = (await this.cacheManager.get<string>(cacheKey)) ?? null;
			if (value) {
				await this.cacheManager.del(cacheKey);
			}
			return this.deserialize(value);
		} finally {
			GithubOAuthStateService.inFlightConsume.delete(cacheKey);
		}
	}

	/** Safely parse a cached state value, returning `null` for anything malformed. */
	private deserialize(value: unknown): IGithubOAuthState | null {
		if (!value || typeof value !== 'string') {
			return null;
		}
		try {
			const parsed = JSON.parse(value) as IGithubOAuthState;
			return parsed && parsed.tenantId && parsed.organizationId ? parsed : null;
		} catch (error) {
			this.logger.warn(`Failed to parse GitHub OAuth state: ${(error as Error)?.message}`);
			return null;
		}
	}
}
