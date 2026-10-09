import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { handoffThrottled, setRetryAfter } from '../http/zitadel-retry';
import { ZitadelStoreService } from '../services/zitadel-store.service';

/** Metadata key of {@link HandoffKeyThrottle}. */
export const ZITADEL_HANDOFF_THROTTLE = 'auth-zitadel:handoff-throttle';

/** A per-key limit: at most `limit` requests with one key per `ttl` milliseconds. */
export interface ZitadelHandoffThrottleOptions {
	/** Name of the counter (one per route). */
	bucket: string;
	limit: number;
	ttl: number;
}

/** One-time keys as the routes accept them; anything else is left to the body validation (400). */
const KEY_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

/**
 * Limits how often one one-time key (`handoff` in the body) may be used, in addition to the route's
 * per-address limit. Many people can sit behind one address (every person signing in through
 * another first-party app's server shares that server's address), so the per-address limit alone
 * would let one key use up everyone's allowance.
 */
export const HandoffKeyThrottle = (bucket: string, limits: { limit: number; ttl: number }) => {
	const options: ZitadelHandoffThrottleOptions = { bucket, limit: limits.limit, ttl: limits.ttl };
	return SetMetadata(ZITADEL_HANDOFF_THROTTLE, options);
};

/**
 * Applies {@link HandoffKeyThrottle}: over the limit the answer is 429 `handoff_throttled` with
 * `Retry-After`, before the route touches the key's record.
 */
@Injectable()
export class ZitadelHandoffThrottleGuard implements CanActivate {
	constructor(
		private readonly reflector: Reflector,
		private readonly store: ZitadelStoreService
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const options = this.reflector.get<ZitadelHandoffThrottleOptions | undefined>(
			ZITADEL_HANDOFF_THROTTLE,
			context.getHandler()
		);
		if (!options) {
			return true;
		}
		const http = context.switchToHttp();
		const key = (http.getRequest()?.body as { handoff?: unknown } | undefined)?.handoff;
		if (typeof key !== 'string' || !KEY_PATTERN.test(key)) {
			return true;
		}
		const result = await this.store.hit(options.bucket, key, options.limit, options.ttl);
		if (!result.allowed) {
			setRetryAfter(http.getResponse(), result.retryAfterSeconds);
			throw handoffThrottled(result.retryAfterSeconds);
		}
		return true;
	}
}
