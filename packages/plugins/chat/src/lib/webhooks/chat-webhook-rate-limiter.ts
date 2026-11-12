import { Inject, Injectable, Optional } from '@nestjs/common';
import { getStorageToken, ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import { ID } from '@gauzy/contracts';

type Env = Record<string, string | undefined>;

/** The windows a webhook post is counted in. */
export interface IChatWebhookRateLimits {
	/** Posts one webhook may make per minute. */
	perMinute: number;
	/** Posts one webhook may make per 10 seconds (its burst). */
	burst: number;
	/** Posts all the webhooks of one organization may make per minute. */
	organizationPerMinute: number;
	/** Posts all the webhooks of one organization may make per 10 seconds. */
	organizationBurst: number;
}

export const CHAT_WEBHOOK_DEFAULT_RATE_LIMITS: IChatWebhookRateLimits = {
	perMinute: 60,
	burst: 20,
	organizationPerMinute: 600,
	organizationBurst: 100
};

const ENV_NAMES: Record<keyof IChatWebhookRateLimits, string> = {
	perMinute: 'GAUZY_CHAT_WEBHOOK_RATE_PER_MINUTE',
	burst: 'GAUZY_CHAT_WEBHOOK_RATE_BURST',
	organizationPerMinute: 'GAUZY_CHAT_WEBHOOK_ORG_RATE_PER_MINUTE',
	organizationBurst: 'GAUZY_CHAT_WEBHOOK_ORG_RATE_BURST'
};

/** The limits the environment states (positive whole numbers), the defaults for anything unset or unusable. */
export function chatWebhookRateLimits(env: Env = process.env): IChatWebhookRateLimits {
	const limits = { ...CHAT_WEBHOOK_DEFAULT_RATE_LIMITS };
	for (const key of Object.keys(ENV_NAMES) as Array<keyof IChatWebhookRateLimits>) {
		const raw = env[ENV_NAMES[key]];
		const value = raw === undefined || raw.trim() === '' ? NaN : Number(raw.trim());
		if (Number.isInteger(value) && value > 0) limits[key] = value;
	}
	return limits;
}

/** What a post's count decided. */
export type ChatWebhookRateDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number };

const MINUTE_MS = 60_000;
const BURST_MS = 10_000;
const THROTTLER_NAME = 'chat-webhook';

/**
 * Rate limits of webhook posts: per webhook and per organization, each a one-minute window and a ten-second burst
 * window. A window that overflows refuses every post for its own length (a sender backs off, it does not trickle).
 *
 * The counters live in the platform's throttler storage when it has one (Redis when configured: one count across
 * every API replica), else in this process. The windows are counted most specific first and stop at the first
 * refusal, so a refused post is not counted in the windows after it.
 */
@Injectable()
export class ChatWebhookRateLimiter {
	private readonly storage: ThrottlerStorage;

	constructor(@Optional() @Inject(getStorageToken()) storage?: ThrottlerStorage | null) {
		this.storage = storage ?? new ThrottlerStorageService();
	}

	async take(webhookId: ID, organizationKey: string, limits: IChatWebhookRateLimits = chatWebhookRateLimits()): Promise<ChatWebhookRateDecision> {
		const windows: Array<[string, number, number]> = [
			[`chat-webhook:${webhookId}:burst`, BURST_MS, limits.burst],
			[`chat-webhook:${webhookId}:minute`, MINUTE_MS, limits.perMinute],
			[`chat-webhook-org:${organizationKey}:burst`, BURST_MS, limits.organizationBurst],
			[`chat-webhook-org:${organizationKey}:minute`, MINUTE_MS, limits.organizationPerMinute]
		];
		for (const [key, ttl, limit] of windows) {
			const record = await this.storage.increment(key, ttl, limit, ttl, THROTTLER_NAME);
			if (record.isBlocked) {
				return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(record.timeToBlockExpire || record.timeToExpire || ttl / 1000)) };
			}
		}
		return { allowed: true };
	}
}
