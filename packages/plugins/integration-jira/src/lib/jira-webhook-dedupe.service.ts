import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { EVER_REDIS_CLIENT } from '@gauzy/core';
import { JIRA_WEBHOOK_DEDUPE_MS } from './jira.constants';

/** The slice of the (node-redis) client used for the atomic claim. */
interface RedisClaimClient {
	set(key: string, value: string, options: { NX: true; PX: number }): Promise<string | null>;
	del(key: string): Promise<unknown>;
}

const KEY_PREFIX = 'jira_webhook_delivery:';

/**
 * The deliveries a connection took lately, so a delivery Jira retries (the same `X-Atlassian-Webhook-Identifier`) is
 * applied once. A delivery is claimed when it arrives — with Redis (`REDIS_ENABLED=true`) by an atomic `SET NX`, one
 * claim across every replica; without it in this process — and released when its apply failed, so the retry that
 * follows applies it after all. A claim lapses after {@link JIRA_WEBHOOK_DEDUPE_MS} (Jira retries within the hour).
 * A store that does not answer never refuses a delivery: applying an issue twice is harmless (the id map makes the
 * second a no-op), losing one is not.
 */
@Injectable()
export class JiraWebhookDedupeService {
	private readonly logger = new Logger(JiraWebhookDedupeService.name);
	/** Delivery keys claimed in this process → when (the non-Redis store). */
	private readonly claimed = new Map<string, number>();

	constructor(@Optional() @Inject(EVER_REDIS_CLIENT) private readonly redis: RedisClaimClient | null = null) {}

	/** Claims a delivery of a connection; false when it was claimed already (a retry of one being or already applied). */
	async claim(integrationId: string, deliveryId: string, now = Date.now()): Promise<boolean> {
		const key = `${KEY_PREFIX}${integrationId}:${deliveryId}`;
		if (this.redis) {
			try {
				return (await this.redis.set(key, String(now), { NX: true, PX: JIRA_WEBHOOK_DEDUPE_MS })) !== null;
			} catch (error) {
				this.logger.warn(`A webhook delivery could not be claimed in Redis (it is applied): ${(error as Error)?.message ?? error}`);
				return true;
			}
		}
		// The map keeps its claims in the order they were made, so the lapsed ones are its first ones: they go, and the
		// scan stops at the first live claim (a claim costs the claims that lapsed, not every claim of the hour).
		for (const [claimedKey, at] of this.claimed) {
			if (now - at <= JIRA_WEBHOOK_DEDUPE_MS) break;
			this.claimed.delete(claimedKey);
		}
		if (this.claimed.has(key)) return false;
		this.claimed.set(key, now);
		return true;
	}

	/** Releases a delivery whose apply failed: its retry is applied. */
	async release(integrationId: string, deliveryId: string): Promise<void> {
		const key = `${KEY_PREFIX}${integrationId}:${deliveryId}`;
		this.claimed.delete(key);
		if (this.redis) {
			await this.redis.del(key).catch((error: unknown) => this.logger.warn(`A failed webhook delivery could not be released: ${(error as Error)?.message ?? error}`));
		}
	}
}
