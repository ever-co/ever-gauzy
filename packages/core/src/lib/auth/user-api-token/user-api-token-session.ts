import { decode } from 'jsonwebtoken';
import { RequestContext } from '../../core/context/request-context';

/**
 * The access-token claim that marks a token minted by the API token exchange and names the API token behind it.
 *
 * Such a session has the user's role and permissions on every route, and the route guards do not treat it differently.
 * What the claim is for is the handful of actions that would let a session OUTLIVE its API token: minting first-party
 * tokens (a refresh token rotates for ever), creating another API token, approving an application, creating an
 * account. `assertFirstPartyRequest` refuses those, so that revoking an API token ends what was done with it within
 * the session's short lifetime (`USER_API_TOKEN_SESSION_TTL_MS`).
 */
export const USER_API_TOKEN_CLAIM = 'apiTokenId';

/**
 * Reads the claim from a decoded access token.
 *
 * @param payload The decoded token.
 * @returns The API token's id, or null when the token does not carry a usable claim.
 */
export function readUserApiTokenClaim(payload: unknown): string | null {
	if (!payload || typeof payload !== 'object') {
		return null;
	}
	const value = (payload as Record<string, unknown>)[USER_API_TOKEN_CLAIM];
	return typeof value === 'string' && value ? value : null;
}

/**
 * Whether the current request presents an access token minted by the API token exchange.
 *
 * Read from the bearer token rather than from anything the JWT strategy pins on the user, so that the strategy stays
 * exactly as it was. The signature is not checked here: on an authenticated route the guard already did, and on a
 * public route a forged claim can only cause a refusal its sender could have avoided by not sending it.
 *
 * @returns True for a session that came from an API token.
 */
export function isUserApiTokenSession(): boolean {
	try {
		const token = RequestContext.currentToken();
		return typeof token === 'string' && !!readUserApiTokenClaim(decode(token));
	} catch {
		// A value that cannot even be decoded was not minted by the exchange.
		return false;
	}
}
