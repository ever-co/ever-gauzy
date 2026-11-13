/** A token Ever ID issued, with the time it stops being used here (seconds since the epoch). */
export interface EverIdIssuedToken {
	token: string;
	/** Already shortened by a safety margin: a caller may use the token until then. */
	expiresAt: number;
}

/** What a caller asks Ever ID for in a token exchange (RFC 8693). */
export interface EverIdExchangeRequest {
	/** The audience of the token asked for (for Ever Platform: its project id). */
	audience: string;
	/** The scopes asked for, space-separated (for the App Launcher: `apps:read`). */
	scope: string;
}

/** Why a token exchange could not give a token (a code only, never a token or a response body). */
export class EverIdExchangeError extends Error {
	constructor(readonly code: 'not_configured' | 'issuer_unreachable' | 'exchange_refused' | 'invalid_answer') {
		super(`Ever ID could not exchange the token (${code}).`);
		this.name = 'EverIdExchangeError';
	}
}

/**
 * What this plugin offers the App Launcher (served by the Ever Platform connection plugin) while
 * `EVER_APP_LAUNCHER_ENABLED=true`:
 *
 * - `sessionOf`: the Ever ID session (`sid`) of the user's newest Ever ID sign-in that keeps a refresh token, or
 *   `null` (the person signed in some other way, signed out of Ever ID, or the launcher is off);
 * - `exchange`: a token for another audience, exchanged (RFC 8693) at the Ever ID issuer for that session's
 *   person with this installation's client, or `null` when the session can no longer give one (its refresh token
 *   was refused or removed: the person signs in with Ever ID again). Throws {@link EverIdExchangeError} when the
 *   issuer cannot be reached or refuses the exchange.
 *
 * Nothing a caller gets is stored by this plugin, and no token ever appears in a URL or a log line.
 *
 * Provided by this plugin under {@link EVER_ID_SESSION_TOKENS} when it is loaded.
 */
export interface EverIdSessionTokensPort {
	sessionOf(userId: string): Promise<string | null>;
	exchange(sid: string, request: EverIdExchangeRequest): Promise<EverIdIssuedToken | null>;
}

/** Injection token of {@link EverIdSessionTokensPort}. */
export const EVER_ID_SESSION_TOKENS = 'EVER_ID_SESSION_TOKENS';

/**
 * How this plugin encrypts the Ever ID refresh token a session keeps for the App Launcher, provided by the Ever
 * Platform connection plugin (which serves the launcher) while `EVER_APP_LAUNCHER_ENABLED=true`: AES-256-GCM under
 * `ENCRYPTION_KEY` (or a `JWT_SECRET` that is not a published default), exactly as the installation's own keys are
 * stored, with a purpose of its own bound into the ciphertext.
 *
 * - `usable`: whether a value can be stored safely with this process's secrets (otherwise nothing is kept);
 * - `seal`: the encrypted form of a value;
 * - `open`: the value, or `null` when it cannot be read with this process's secrets (the secret changed).
 *
 * Without it (the connection plugin not loaded, or the launcher off) no refresh token is ever kept.
 */
export interface EverIdTokenVaultPort {
	usable(): boolean;
	seal(value: string): string;
	open(blob: string | null | undefined): string | null;
}

/** Injection token of {@link EverIdTokenVaultPort}. */
export const EVER_ID_TOKEN_VAULT = 'EVER_ID_TOKEN_VAULT';
