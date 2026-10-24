import { JwtPayload, verify } from 'jsonwebtoken';
import { ExtractJwt } from 'passport-jwt';
import { environment } from '@gauzy/config';
import { isAccessTokenPayload, isNonEmptyString, JWT_ALGORITHMS } from '../auth/purpose-token';

/**
 * Prefix of a signed-in user's rate-limit bucket. No address normalised by `normalizeTrackerIp`, and none of
 * the constant buckets, can start with it, so a user bucket never collides with an address bucket.
 */
export const USER_THROTTLER_TRACKER_PREFIX = 'user:';

/** Reads the token exactly where `JwtStrategy` reads it: the `Authorization: Bearer <token>` header. */
const bearerToken = ExtractJwt.fromAuthHeaderAsBearerToken();

/**
 * The rate-limit bucket of the user a request's access token names, or `null` when the request carries no
 * access token that verifies.
 *
 * The throttler is the first global guard, so it runs BEFORE authentication and `req.user` is not set yet.
 * The token is therefore verified here, with the same secret and options as `JwtStrategy` (HS256 only,
 * expiry enforced, `JWT_SECRET`), and its subject is believed only then: an unverified `id` would let a
 * caller name a fresh bucket per request (the defect GHSA-86mw-2crg-vmhc describes). The checks that need
 * no database follow the strategy too: the payload must be an access token (not a password-reset,
 * workspace sign-in, invite, ... token signed with the same secret) and must name a user.
 *
 * What this does not check: whether the user, employee or membership is still active. Those need the
 * database, and the authentication guard that runs next refuses such a token anyway; counting its
 * requests in its user's bucket first changes nothing for anyone else.
 *
 * @param req - The incoming request (only its `Authorization` header is read).
 * @param secret - The access-token secret; defaults to `JWT_SECRET`, as `JwtStrategy` uses.
 * @returns `user:<id>` (or `user:third-party:<thirdPartyId>` for a token that names only that), or `null`.
 */
export function resolveUserThrottlerTracker(
	req: Record<string, any> | undefined,
	secret: string | undefined = environment.JWT_SECRET
): string | null {
	if (!req?.headers || !isNonEmptyString(secret)) {
		return null;
	}

	let token: string | null;
	try {
		token = bearerToken(req as any);
	} catch {
		return null;
	}

	if (!isNonEmptyString(token)) {
		return null;
	}

	let payload: string | JwtPayload;
	try {
		payload = verify(token, secret, { algorithms: JWT_ALGORITHMS });
	} catch {
		// Forged, expired, not yet valid, or not a JWT at all: counted by address, like any anonymous request.
		return null;
	}

	if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !isAccessTokenPayload(payload)) {
		return null;
	}

	if (isNonEmptyString(payload['id'])) {
		return `${USER_THROTTLER_TRACKER_PREFIX}${payload['id']}`;
	}

	if (isNonEmptyString(payload['thirdPartyId'])) {
		return `${USER_THROTTLER_TRACKER_PREFIX}third-party:${payload['thirdPartyId']}`;
	}

	return null;
}
