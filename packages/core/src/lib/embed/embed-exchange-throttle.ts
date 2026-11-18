import { ExecutionContext } from '@nestjs/common';
import { resolveThrottlerTracker, throttlerTrackerOptions } from '../throttler/tracker';
import { hashEmbedCredential, isWellFormedEmbedCredential } from './embed.utils';

/** The window an exchange is counted in, in milliseconds. */
export const EMBED_EXCHANGE_THROTTLE_TTL_MS = 60_000;

/**
 * How many exchanges one credential makes in a window, from any address. A host's backend exchanges its credential for
 * every member it serves, all from its own address: the budget follows the credential, so a large host is not held to
 * what one address may ask.
 */
export const EMBED_EXCHANGE_LIMIT_PER_CREDENTIAL = 600;

/** How many exchanges without a well-formed credential one address makes in a window, against guessing. */
export const EMBED_EXCHANGE_LIMIT_PER_ADDRESS = 60;

/**
 * The prefix of a credential's bucket. No address bucket (`normalizeTrackerIp`, `UNRESOLVED_THROTTLER_TRACKER`) and no
 * user bucket (`user:`) starts with it.
 */
export const EMBED_CREDENTIAL_THROTTLER_TRACKER_PREFIX = 'embed-credential:';

/**
 * The client address an exchange comes from, resolved as for every anonymous route.
 *
 * @param req The request.
 */
export function embedExchangeAddress(req: Record<string, any>): string {
	return resolveThrottlerTracker(req, throttlerTrackerOptions());
}

/** The credential an exchange presents, when it has the shape of one. */
function wellFormedCredentialOf(req: Record<string, any> | undefined): string | null {
	const credential: unknown = req?.body?.credential;
	if (!isWellFormedEmbedCredential(credential)) {
		return null;
	}
	return credential;
}

/**
 * The bucket an exchange is counted in: its credential's, named by the credential's SHA-256 so the secret is never a
 * storage key, or the client address, resolved as for every anonymous route, when the body holds no well-formed one.
 *
 * @param req The request; its body is parsed before the guards run.
 * @returns The bucket key.
 */
export function embedExchangeTracker(req: Record<string, any>): string {
	const credential = wellFormedCredentialOf(req);
	if (credential === null) {
		return embedExchangeAddress(req);
	}
	return `${EMBED_CREDENTIAL_THROTTLER_TRACKER_PREFIX}${hashEmbedCredential(credential)}`;
}

/**
 * The limit of the bucket {@link embedExchangeTracker} counts the request in.
 *
 * @param context The execution context of the exchange.
 * @returns The requests that bucket allows in a window.
 */
export function embedExchangeLimit(context: ExecutionContext): number {
	const req = context.switchToHttp().getRequest<Record<string, any>>();
	if (wellFormedCredentialOf(req) === null) {
		return EMBED_EXCHANGE_LIMIT_PER_ADDRESS;
	}
	return EMBED_EXCHANGE_LIMIT_PER_CREDENTIAL;
}

/** The `@Throttle` options of `POST /embed/token`: the buckets and limits above, for that route only. */
export const EMBED_EXCHANGE_THROTTLE = {
	default: {
		limit: embedExchangeLimit,
		ttl: EMBED_EXCHANGE_THROTTLE_TTL_MS,
		getTracker: embedExchangeTracker
	}
};
