import { IUserSession } from '@gauzy/contracts';
import { IToken } from '../../token/interfaces';
import { USER_API_TOKEN_CLAIM } from '../user-api-token/user-api-token-session';
import { describeSessionClient } from './user-session-client';
import { readSessionClaims } from './user-session-claims';

/** A user's active tokens, as the token store holds them. */
export interface IUserSessionTokens {
	refreshTokens: IToken[];
	accessTokens: IToken[];
}

/** The tokens of one session, and the id the session is listed and signed out under. */
export interface IUserSessionGroup {
	id: string;
	tokens: IToken[];
}

/** Whether the token can still be used: not past its expiry. Its status is ACTIVE already (the store's read). */
function isLive(token: IToken, now: Date): boolean {
	if (!token.expiresAt) {
		return true;
	}
	return new Date(token.expiresAt).getTime() > now.getTime();
}

/**
 * Whether an access token belongs to a sign-in of the user, rather than to an API token's exchange or a third-party
 * application's grant: those are not sessions of the user and are never signed out with them.
 */
export function isFirstPartyAccessToken(token: IToken): boolean {
	const metadata = token.metadata ?? {};
	const fromApiToken = !!metadata[USER_API_TOKEN_CLAIM];
	const fromApplication = !!metadata['oauthApp'];
	return !fromApiToken && !fromApplication;
}

/** The session id a token names, or null for one minted before sessions were named. */
export function sessionIdOf(token: IToken): string | null {
	return readSessionClaims(token.metadata)?.sessionId ?? null;
}

/**
 * Groups a user's live tokens into sessions.
 *
 * A session is the tokens that name one session id: the refresh token of a sign-in (its latest rotation) and the access
 * tokens minted with it. A refresh token minted before sessions were named is a session of its own, under its own id,
 * until its next refresh names one. An access token minted before then is not listed: it expires within the access
 * token lifetime, and its refresh token already stands for its device.
 *
 * @param tokens The user's active tokens.
 * @param now The time to judge expiry at.
 * @returns The sessions, each with its tokens.
 */
export function groupUserSessions(tokens: IUserSessionTokens, now: Date): IUserSessionGroup[] {
	const groups = new Map<string, IToken[]>();
	const add = (id: string, token: IToken) => {
		const group = groups.get(id) ?? [];
		group.push(token);
		groups.set(id, group);
	};

	for (const token of tokens.refreshTokens.filter((candidate) => isLive(candidate, now))) {
		add(sessionIdOf(token) ?? token.id, token);
	}

	const sessionAccessTokens = tokens.accessTokens.filter(
		(token) => isLive(token, now) && isFirstPartyAccessToken(token) && sessionIdOf(token) !== null
	);
	for (const token of sessionAccessTokens) {
		add(sessionIdOf(token), token);
	}

	return [...groups.entries()].map(([id, groupTokens]) => ({ id, tokens: groupTokens }));
}

/** A date read from a stored token (a `Date` from the ORM, or a string from a JSON column). */
function timeOf(value: Date | string | null | undefined): number | null {
	if (!value) {
		return null;
	}
	const time = new Date(value).getTime();
	if (Number.isNaN(time)) {
		return null;
	}
	return time;
}

/** When a token was last used: its recorded last use, or its creation. */
function lastUseOf(token: IToken): number {
	return timeOf(token.lastUsedAt) ?? timeOf(token.createdAt) ?? 0;
}

/** A metadata value when it is a non-empty string, otherwise null. */
function stringOrNull(value: unknown): string | null {
	if (typeof value !== 'string' || value.length === 0) {
		return null;
	}
	return value;
}

/**
 * Describes one session for its user.
 *
 * @param group The session's tokens.
 * @param currentSessionId The session the request is made from, null when its token names none.
 * @returns The session as the list answers it.
 */
export function describeUserSession(group: IUserSessionGroup, currentSessionId: string | null): IUserSession {
	const newestFirst = [...group.tokens].sort(
		(left, right) => (timeOf(right.createdAt) ?? 0) - (timeOf(left.createdAt) ?? 0)
	);
	const newest = newestFirst[0];
	const metadata = newest.metadata ?? {};
	const userAgent = stringOrNull(metadata['userAgent']);
	const ipAddress = stringOrNull(metadata['ipAddress']);
	const client = describeSessionClient(userAgent);

	const startedAt = timeOf(readSessionClaims(newest.metadata)?.sessionStartedAt);
	const oldestCreation = Math.min(...group.tokens.map((token) => timeOf(token.createdAt) ?? Date.now()));
	const lastActive = Math.max(...group.tokens.map((token) => lastUseOf(token)));

	return {
		id: group.id,
		current: group.id === currentSessionId,
		app: client.app,
		browser: client.browser,
		os: client.os,
		userAgent,
		ipAddress,
		signedInAt: new Date(startedAt ?? oldestCreation),
		lastActiveAt: new Date(lastActive)
	};
}

/**
 * The user's sessions, the current one first, then the most recently used.
 *
 * @param tokens The user's active tokens.
 * @param currentSessionId The session the request is made from, null when its token names none.
 * @param now The time to judge expiry at.
 * @returns The sessions.
 */
export function listUserSessions(
	tokens: IUserSessionTokens,
	currentSessionId: string | null,
	now: Date
): IUserSession[] {
	const sessions = groupUserSessions(tokens, now).map((group) => describeUserSession(group, currentSessionId));
	return sessions.sort((left, right) => {
		if (left.current && !right.current) {
			return -1;
		}
		if (right.current && !left.current) {
			return 1;
		}
		return right.lastActiveAt.getTime() - left.lastActiveAt.getTime();
	});
}
