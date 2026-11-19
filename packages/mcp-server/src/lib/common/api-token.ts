import { sanitizeErrorMessage } from './error-utils';

/**
 * A personal API token (GAUZY_API_TOKEN): a user creates it in Settings > API Tokens of the Gauzy web app and revokes
 * it there. The server exchanges it for an access token that lasts an hour at most and comes with no refresh token.
 */

/** The API route that exchanges a personal API token for an access token */
export const API_TOKEN_EXCHANGE_PATH = '/api/auth/api-token/exchange';

/** The shape the API gives every token (`user-api-token.utils.ts` in packages/core): `gzp_` and 43 base64url characters */
const API_TOKEN_SHAPE = /^gzp_[A-Za-z0-9_-]{43}$/;

/** What the person who set GAUZY_API_TOKEN reads when it gives no session. None of them quotes the token. */
export const API_TOKEN_MESSAGES = {
	malformed:
		'GAUZY_API_TOKEN does not look like a Gauzy API token, which starts with gzp_ and is 47 characters long. ' +
		'Copy it again from Settings > API Tokens of the Gauzy web app.',
	refused:
		'The Gauzy API token was refused: it was revoked, it expired, or this server does not know it. ' +
		'Create a new token in Settings > API Tokens of the Gauzy web app, ' +
		'put it in GAUZY_API_TOKEN and restart the MCP server.',
	disabled:
		'Personal API tokens are off on this Gauzy server. ' +
		'Its administrator turns them on with GAUZY_USER_API_TOKENS_ENABLED=true.'
} as const;

/** Why an exchange gave no access token */
export interface IApiTokenExchangeFailure {
	message: string;
	/** The API judged the token and refused it: sending it again cannot succeed */
	isRefusal: boolean;
}

/**
 * GAUZY_API_TOKEN as configured, without the spaces a copy and paste may add.
 *
 * @param value The raw setting.
 * @returns The token, or an empty string when none is set.
 */
export function readApiTokenSetting(value: string | undefined = process.env.GAUZY_API_TOKEN): string {
	return (value ?? '').trim();
}

/**
 * Checks GAUZY_API_TOKEN at start, so that a value that cannot be a token is refused before any request.
 *
 * @param token The setting, as {@link readApiTokenSetting} returns it.
 * @returns The error to report, or null when no token is set or it has the shape of one.
 */
export function apiTokenSettingError(token: string): string | null {
	if (!token) {
		return null;
	}
	if (API_TOKEN_SHAPE.test(token)) {
		return null;
	}
	return API_TOKEN_MESSAGES.malformed;
}

/**
 * Explains a failed exchange to the person who set the token.
 *
 * @param error What the request to the exchange route threw.
 * @returns The message, and whether the API refused the token itself.
 */
export function describeApiTokenExchangeFailure(error: unknown): IApiTokenExchangeFailure {
	const status = (error as { response?: { status?: number } })?.response?.status;
	if (status === 401) {
		return { message: API_TOKEN_MESSAGES.refused, isRefusal: true };
	}
	// The route answers 404 while GAUZY_USER_API_TOKENS_ENABLED is off
	if (status === 404) {
		return { message: API_TOKEN_MESSAGES.disabled, isRefusal: false };
	}
	return { message: `Could not exchange the Gauzy API token: ${sanitizeErrorMessage(error)}`, isRefusal: false };
}
