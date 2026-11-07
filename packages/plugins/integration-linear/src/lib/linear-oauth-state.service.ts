import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { randomBytes } from 'node:crypto';
import { ID } from '@gauzy/contracts';

/**
 * What the platform remembers when a signed-in person starts the connect flow: the tenant and
 * organization the connection will belong to, and who they are. The opaque `state` nonce goes to Linear
 * and comes back on the callback, which binds the connection to this record — never to anything the
 * callback's query says.
 */
export interface LinearOAuthState {
	tenantId: ID;
	organizationId: ID;
	userId?: ID;
}

const CACHE_PREFIX = 'linear_oauth_state:';
/** Long enough to authorize on Linear, short enough to limit a replay. */
const TTL_MS = 10 * 60 * 1000;
/** A minted nonce: 32 random bytes as lowercase hex. */
const NONCE_PATTERN = /^[a-f0-9]{64}$/;

/** The single-use `state` nonces of the connect flow, kept in the platform's cache (shared across replicas when it is Redis). */
@Injectable()
export class LinearOAuthStateService {
	private readonly logger = new Logger(LinearOAuthStateService.name);
	/** The nonces being consumed in this process: the read and the delete are not one operation on every cache. */
	private readonly consuming = new Set<string>();

	constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

	/** Mints a nonce bound to the given scope. */
	async create(state: LinearOAuthState): Promise<string> {
		const nonce = randomBytes(32).toString('hex');
		await this.cache.set(`${CACHE_PREFIX}${nonce}`, JSON.stringify(state), TTL_MS);
		return nonce;
	}

	/** Resolves a nonce and invalidates it (single use); `null` for an unknown, malformed or expired one. */
	async consume(nonce?: string): Promise<LinearOAuthState | null> {
		if (!nonce || !NONCE_PATTERN.test(nonce)) {
			return null;
		}
		const key = `${CACHE_PREFIX}${nonce}`;
		if (this.consuming.has(key)) {
			return null;
		}
		this.consuming.add(key);
		try {
			const value = (await this.cache.get<string>(key)) ?? null;
			if (value) {
				await this.cache.del(key);
			}
			return this.parse(value);
		} finally {
			this.consuming.delete(key);
		}
	}

	private parse(value: unknown): LinearOAuthState | null {
		if (!value || typeof value !== 'string') {
			return null;
		}
		try {
			const parsed = JSON.parse(value) as LinearOAuthState;
			return parsed && parsed.tenantId && parsed.organizationId ? parsed : null;
		} catch (error) {
			this.logger.warn(`A stored connect state could not be read: ${(error as Error)?.message}`);
			return null;
		}
	}
}
