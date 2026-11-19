/**
 * A personal API token (GAUZY_API_TOKEN): a user creates it in Settings > API Tokens of the Gauzy web app and revokes
 * it there. The server exchanges it for an access token that lasts an hour at most and comes with no refresh token.
 */

/** The shape the API gives every token (`user-api-token.utils.ts` in packages/core): `gzp_` and 43 base64url characters */
const API_TOKEN_SHAPE = /^gzp_[A-Za-z0-9_-]{43}$/;

/** What the person who set GAUZY_API_TOKEN reads when it gives no session. None of them quotes the token. */
export const API_TOKEN_MESSAGES = {
	malformed:
		'GAUZY_API_TOKEN does not look like a Gauzy API token, which starts with gzp_ and is 47 characters long. ' +
		'Copy it again from Settings > API Tokens of the Gauzy web app.'
} as const;

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
