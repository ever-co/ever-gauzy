import { ExecutionContext } from '@nestjs/common';
import { resolveThrottlerTracker, throttlerTrackerOptions } from '../throttler/tracker';
import { recentlyAcceptedEmbedCredentials } from './embed-exchange-failures';
import { hashEmbedCredential, isWellFormedEmbedCredential } from './embed.utils';

/** The window an exchange is counted in, in milliseconds. */
export const EMBED_EXCHANGE_THROTTLE_TTL_MS = 60_000;

/**
 * How many exchanges one credential makes in a window, from any address, once this instance accepted it. A host's
 * backend exchanges its credential for every member it serves, all from its own address: the budget follows the
 * credential, so a large host is not held to what one address may ask.
 */
export const EMBED_EXCHANGE_LIMIT_PER_CREDENTIAL = 600;

/**
 * How many exchanges one address makes in a window with anything else: no well-formed credential, or one this instance
 * has not accepted recently (made-up ones, or a host's first exchange here), against guessing.
 */
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

/** The decision of {@link acceptedCredentialDigestOf}, by request. */
const CLASSIFIED = new WeakMap<object, string | null>();

/**
 * The digest of the credential an exchange presents, when it has the shape of one and this instance accepted it
 * recently (`recentlyAcceptedEmbedCredentials`). Only those get a bucket of their own: a bucket per made-up credential
 * would give each request a fresh budget and a storage entry, without bound.
 */
function acceptedCredentialDigestOf(req: Record<string, any> | undefined): string | null {
	// Decided once per request: the throttler asks for the limit, then for the bucket, and an acceptance that expired
	// between the two would give the address bucket the credential's limit.
	if (req && typeof req === 'object' && CLASSIFIED.has(req)) {
		return CLASSIFIED.get(req) ?? null;
	}
	const credential: unknown = req?.body?.credential;
	let digest: string | null = null;
	if (isWellFormedEmbedCredential(credential)) {
		const candidate = hashEmbedCredential(credential);
		digest = recentlyAcceptedEmbedCredentials.has(candidate) ? candidate : null;
	}
	if (req && typeof req === 'object') {
		CLASSIFIED.set(req, digest);
	}
	return digest;
}

/**
 * The bucket an exchange is counted in: its credential's, named by the credential's SHA-256 so the secret is never a
 * storage key, when this instance accepted that credential recently; otherwise the client address, resolved as for
 * every anonymous route.
 *
 * @param req The request; its body is parsed before the guards run.
 * @returns The bucket key.
 */
export function embedExchangeTracker(req: Record<string, any>): string {
	const digest = acceptedCredentialDigestOf(req);
	if (digest === null) {
		return embedExchangeAddress(req);
	}
	return `${EMBED_CREDENTIAL_THROTTLER_TRACKER_PREFIX}${digest}`;
}

/**
 * The limit of the bucket {@link embedExchangeTracker} counts the request in.
 *
 * @param context The execution context of the exchange.
 * @returns The requests that bucket allows in a window.
 */
export function embedExchangeLimit(context: ExecutionContext): number {
	const req = context.switchToHttp().getRequest<Record<string, any>>();
	if (acceptedCredentialDigestOf(req) === null) {
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

/**
 * The `@Throttle` options of the routes a site's page calls with a renewal token (`POST /embed/renew`): per client
 * address, with the exchange's limit for an address. A renewal token works once, so it never gets a bucket of its own.
 */
export const EMBED_SITE_THROTTLE = {
	default: {
		limit: EMBED_EXCHANGE_LIMIT_PER_ADDRESS,
		ttl: EMBED_EXCHANGE_THROTTLE_TTL_MS,
		getTracker: embedExchangeAddress
	}
};
