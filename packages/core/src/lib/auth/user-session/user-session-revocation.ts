import { IToken, TokenStatus } from '../../token/interfaces';

/**
 * The revocation reason of a token signed out with its session by the user, from another of their sessions
 * (`UserSessionService`). `JwtStrategy` refuses an access token revoked for this reason at its next request.
 */
export const USER_SESSION_SIGNED_OUT_REASON = 'Session signed out by its user';

/**
 * Whether a stored token was signed out with its session.
 *
 * Only this revocation is enforced on every request. An access token revoked for another reason (a logout, the
 * inactivity clean-up) keeps the behaviour it had before sessions could be signed out: it works until it expires.
 *
 * @param token The stored token.
 * @returns True when the user signed its session out.
 */
export function isSignedOutSessionToken(token: Pick<IToken, 'status' | 'revokedReason'>): boolean {
	const isRevoked = token.status === TokenStatus.REVOKED;
	const bySessionSignOut = token.revokedReason === USER_SESSION_SIGNED_OUT_REASON;
	return isRevoked && bySessionSignOut;
}
