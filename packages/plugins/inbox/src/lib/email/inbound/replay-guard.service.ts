import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { EVER_REDIS_CLIENT } from '@gauzy/core';

/** The part of the Redis client the guard uses (`SET key value NX PX ttl`). */
interface ReplayRedis {
	set(key: string, value: string, options: { NX: true; PX: number }): Promise<string | null>;
}

/** The most remembered deliveries in process (a burst never grows the set without bound). */
const MAX_LOCAL_ENTRIES = 20_000;

/**
 * Single-use webhook signatures (plan 04 §5.2): a verified delivery is remembered until its freshness window has
 * passed, and a repeat is refused, so a captured request cannot be replayed inside the window.
 *
 * With Redis (`REDIS_ENABLED=true`), `SET NX PX` makes it single-use across every API replica. Without it, an
 * in-process set does it per process (a deployment with several replicas then admits at most one replay per
 * replica). If Redis fails, the in-process set takes over for that call.
 */
@Injectable()
export class InboundReplayGuard {
	private readonly logger = new Logger(InboundReplayGuard.name);
	private readonly local = new Map<string, number>();

	constructor(@Optional() @Inject(EVER_REDIS_CLIENT) private readonly redis?: ReplayRedis | null) {}

	/**
	 * Records a delivery and answers whether it is new.
	 *
	 * @param scope Who the delivery is for (the provider and the account), so two accounts never collide.
	 * @param fingerprint What identifies the delivery (its timestamp and signature, or a provider's event id).
	 * @param ttlMs How long it must be remembered (at least its own freshness window).
	 */
	async consume(scope: string, fingerprint: string, ttlMs: number): Promise<boolean> {
		const key = this.keyOf(scope, fingerprint);
		if (this.redis && typeof this.redis.set === 'function') {
			try {
				return (await this.redis.set(key, '1', { NX: true, PX: Math.max(1000, Math.ceil(ttlMs)) })) === 'OK';
			} catch (error) {
				this.logger.warn(`Redis replay check failed; using the in-process set: ${(error as Error)?.name}`);
			}
		}
		return this.consumeLocally(key, ttlMs);
	}

	/** Forgets a delivery again (its storage failed: the provider's retry must get through). Best effort. */
	async release(scope: string, fingerprint: string): Promise<void> {
		const key = this.keyOf(scope, fingerprint);
		this.local.delete(key);
		const redis = this.redis as (ReplayRedis & { del?: (key: string) => Promise<unknown> }) | null | undefined;
		if (redis && typeof redis.del === 'function') {
			try {
				await redis.del(key);
			} catch (error) {
				this.logger.warn(`Redis replay release failed: ${(error as Error)?.name}`);
			}
		}
	}

	private keyOf(scope: string, fingerprint: string): string {
		return `gauzy:inbox:replay:${createHash('sha256').update(`${scope}\n${fingerprint}`).digest('hex')}`;
	}

	private consumeLocally(key: string, ttlMs: number): boolean {
		const now = Date.now();
		for (const [seen, expiresAt] of this.local) {
			if (expiresAt <= now) this.local.delete(seen);
		}
		if (this.local.has(key)) return false;
		while (this.local.size >= MAX_LOCAL_ENTRIES) {
			const oldest = this.local.keys().next();
			if (oldest.done) break;
			this.local.delete(oldest.value);
		}
		this.local.set(key, now + ttlMs);
		return true;
	}
}
