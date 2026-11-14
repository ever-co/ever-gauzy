import { randomUUID } from 'node:crypto';
import { decode } from 'jsonwebtoken';
import { RequestContext } from '../../core/context/request-context';

/**
 * The access- and refresh-token claim naming the session a token belongs to: one sign-in, on one device or app.
 *
 * The token store keeps a sign-in's access token and its refresh tokens as unrelated rows, so nothing told which of a
 * user's tokens came from the same sign-in. Every token minted for a session now carries its id, so the session can be
 * listed once and signed out as a whole (`UserSessionService`).
 */
export const SESSION_ID_CLAIM = 'sessionId';

/** The claim holding when the session started (ISO 8601), carried by every token of the session. */
export const SESSION_STARTED_AT_CLAIM = 'sessionStartedAt';

/** The two session claims of a token. */
export interface IUserSessionClaims {
	sessionId: string;
	sessionStartedAt: string;
}

/**
 * The session a token is minted in, and whether that session existed before the request (`inherited`): only such a
 * session can have been signed out, so only a mint in it asks whether it was (`AuthService`).
 */
export interface IMintedSession {
	claims: IUserSessionClaims;
	inherited: boolean;
}

/** Where a request keeps the session of each user it mints tokens for. */
const SESSIONS_OF_REQUEST = Symbol('userSessionsOfRequest');

/**
 * Reads the session claims of a decoded token.
 *
 * @param payload The decoded token.
 * @returns Its session claims, or null when it carries none (a token minted before sessions were named).
 */
export function readSessionClaims(payload: unknown): IUserSessionClaims | null {
	if (!payload || typeof payload !== 'object') {
		return null;
	}
	const claims = payload as Record<string, unknown>;
	const sessionId = claims[SESSION_ID_CLAIM];
	const sessionStartedAt = claims[SESSION_STARTED_AT_CLAIM];
	const hasSessionId = typeof sessionId === 'string' && sessionId.length > 0;
	const hasStart = typeof sessionStartedAt === 'string' && sessionStartedAt.length > 0;
	if (!hasSessionId || !hasStart) {
		return null;
	}
	return { sessionId, sessionStartedAt };
}

/**
 * The session claims of the bearer token the current request was made with.
 *
 * The signature is not checked here: on an authenticated route the guard already did.
 *
 * @returns Its session claims, or null without a token or for a token minted before sessions were named.
 */
export function currentRequestSessionClaims(): IUserSessionClaims | null {
	try {
		const token = RequestContext.currentToken();
		if (typeof token !== 'string') {
			return null;
		}
		return readSessionClaims(decode(token));
	} catch {
		return null;
	}
}

/** The sessions the current request chose, by user; null outside a request. */
function sessionsOfRequest(): Map<string, IMintedSession> | null {
	const request = RequestContext.currentRequest();
	if (!request) {
		return null;
	}
	if (!request[SESSIONS_OF_REQUEST]) {
		request[SESSIONS_OF_REQUEST] = new Map<string, IMintedSession>();
	}
	return request[SESSIONS_OF_REQUEST];
}

/**
 * Makes `claims` the session of the tokens the current request mints next for `userId`. A refresh calls it with the
 * claims of the refresh token it was given, so the new tokens stay in that session.
 *
 * @param userId The user the tokens are for.
 * @param claims The session they belong to.
 * @param inherited Whether the session existed before this request (false for one just started for an old token).
 */
export function keepSessionForRequest(userId: string, claims: IUserSessionClaims, inherited = true): void {
	sessionsOfRequest()?.set(userId, { claims, inherited });
}

/**
 * The session of a token minted now for `userId`:
 *
 * - the session the current request already chose for that user: the access and refresh tokens of one sign-in share
 *   it, and a refresh keeps the session of the refresh token it was given (`keepSessionForRequest`);
 * - otherwise the session of the request itself, when the request is made by that same user: an organization or
 *   workspace switch keeps the session of the device it is made from;
 * - otherwise a new session, starting now: the only one not inherited.
 *
 * @param userId The user the token is for.
 * @param now The time a new session starts at.
 * @returns The claims to write into the token, and whether the session is inherited.
 */
export function sessionForMint(userId: string, now: Date = new Date()): IMintedSession {
	const sessions = sessionsOfRequest();
	const chosen = sessions?.get(userId);
	if (chosen) {
		return chosen;
	}

	const requestSession = requestSessionOf(userId);
	let minted: IMintedSession = { claims: requestSession, inherited: true };
	if (!requestSession) {
		minted = { claims: { sessionId: randomUUID(), sessionStartedAt: now.toISOString() }, inherited: false };
	}
	sessions?.set(userId, minted);
	return minted;
}

/** The session of the current request when the request is made by `userId`; null otherwise. */
function requestSessionOf(userId: string): IUserSessionClaims | null {
	const isUsersOwnRequest = !!userId && RequestContext.currentUserId() === userId;
	if (!isUsersOwnRequest) {
		return null;
	}
	return currentRequestSessionClaims();
}

/** When a decoded token was issued (its `iat`), or `fallback` when it does not say. */
function issuedAtOf(payload: unknown, fallback: Date): Date {
	if (!payload || typeof payload !== 'object') {
		return fallback;
	}
	const issuedAtSeconds = (payload as Record<string, unknown>)['iat'];
	if (typeof issuedAtSeconds !== 'number') {
		return fallback;
	}
	return new Date(issuedAtSeconds * 1000);
}

/**
 * The session a refresh token belongs to. A refresh token minted before sessions were named starts one, dated from
 * when that token was issued: the first refresh after the change is where such a session gets its id.
 *
 * @param payload The decoded refresh token.
 * @param now The time to date the session from when the token does not say when it was issued.
 * @returns Its session claims.
 */
export function sessionOfRefreshToken(payload: unknown, now: Date = new Date()): IUserSessionClaims {
	const claims = readSessionClaims(payload);
	if (claims) {
		return claims;
	}
	return { sessionId: randomUUID(), sessionStartedAt: issuedAtOf(payload, now).toISOString() };
}
