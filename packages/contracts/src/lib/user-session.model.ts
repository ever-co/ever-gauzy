/**
 * Contract for a signed-in user's sessions: each sign-in, on each device or app, until it is signed out or expires.
 * A user lists their own sessions and signs out the other ones (`/api/auth/sessions`). Personal API tokens are not
 * sessions: they have their own page.
 */

import { ID } from './base-entity.model';

/** The kind of app a session was opened from, as far as its user agent tells. */
export enum UserSessionAppEnum {
	WEB = 'WEB',
	DESKTOP = 'DESKTOP',
	MOBILE = 'MOBILE',
	UNKNOWN = 'UNKNOWN'
}

/** One session of the signed-in user, as `GET /api/auth/sessions` answers it. */
export interface IUserSession {
	/** Names the session in `DELETE /api/auth/sessions/:id`. */
	id: ID;

	/** True for the session the request was made from. */
	current: boolean;

	/** The kind of app, read from the user agent. */
	app: UserSessionAppEnum;

	/** The browser and its major version ("Chrome 131"), when the user agent names one. */
	browser: string | null;

	/** The operating system ("Windows", "macOS", "Android"), when the user agent names one. */
	os: string | null;

	/** The user agent the session was last seen with, as the client sent it. */
	userAgent: string | null;

	/** The address the session was last seen from, as the API resolved it. */
	ipAddress: string | null;

	/** When the session started. */
	signedInAt: Date;

	/** When the session was last used, accurate to a few minutes. */
	lastActiveAt: Date;
}

/**
 * `POST /api/auth/sessions/sign-out-others`: the proof that the person at this session is the account's owner. An
 * account with a password sends it; an account without one sends the code the sign-in code email carries
 * (`POST /api/auth/signin.email`).
 */
export interface IUserSessionSignOutOthersInput {
	password?: string;
	code?: string;
}

/** The answer of `POST /api/auth/sessions/sign-out-others`. */
export interface IUserSessionSignOutOthersResponse {
	/** How many sessions were signed out. */
	signedOut: number;
}
