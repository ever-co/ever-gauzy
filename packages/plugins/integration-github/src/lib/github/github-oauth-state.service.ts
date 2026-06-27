import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { randomBytes } from 'crypto';
import { ID } from '@gauzy/contracts';

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

@Injectable()
export class GithubOAuthStateService {
	private readonly logger = new Logger(GithubOAuthStateService.name);

	/** Cache key prefix for pending GitHub install state nonces. */
	private static readonly CACHE_PREFIX = 'github_oauth_state:';
	/** Single-use nonce lifetime: long enough to complete the GitHub install, short enough to limit replay. */
	private static readonly TTL_MS = 10 * 60 * 1000; // 10 minutes

	constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

	/** Build the namespaced cache key for a nonce. */
	private key(nonce: string): string {
		return `${GithubOAuthStateService.CACHE_PREFIX}${nonce}`;
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
		await this.cacheManager.set(this.key(nonce), JSON.stringify(state), GithubOAuthStateService.TTL_MS);
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
		if (!nonce) {
			return null;
		}
		const value = await this.cacheManager.get<string>(this.key(nonce));
		return this.deserialize(value);
	}

	/**
	 * Resolve and invalidate a nonce so it can bind at most one installation (single-use).
	 *
	 * @returns The bound state, or `null` for an unknown, malformed or expired nonce.
	 */
	async consume(nonce?: string): Promise<IGithubOAuthState | null> {
		if (!nonce) {
			return null;
		}
		const cacheKey = this.key(nonce);
		const value = await this.cacheManager.get<string>(cacheKey);
		const parsed = this.deserialize(value);
		if (parsed) {
			// Best-effort single-use: remove the nonce so a replay cannot reuse it.
			await this.cacheManager.del(cacheKey);
		}
		return parsed;
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
