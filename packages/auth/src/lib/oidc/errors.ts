/**
 * Machine-readable reasons an OpenID Connect step can fail.
 *
 * The codes are part of the library's public API: provider plugins map them to their own
 * user-facing answers, so a code is never reused for a different meaning.
 */
export type OidcErrorCode =
	| 'discovery_failed'
	| 'state_mismatch'
	| 'nonce_mismatch'
	| 'token_invalid'
	| 'email_unverified'
	| 'jwks_unavailable'
	| 'audience_rejected'
	| 'issuer_rejected'
	| 'expired'
	| 'replay'
	| 'exchange_failed';

/**
 * The only error type the OIDC library throws on purpose.
 *
 * The message is meant for logs. The library's own messages never contain a token, a code, a
 * secret or an e-mail address; code that creates an `OidcError` must keep it that way. What callers
 * return to a browser should be derived from `code` only.
 */
export class OidcError extends Error {
	constructor(public readonly code: OidcErrorCode, message?: string) {
		super(message ?? code);
		this.name = 'OidcError';
	}
}

/**
 * Narrows an unknown thrown value to an {@link OidcError}.
 *
 * @param error - Anything caught in a `catch` block.
 * @returns `true` when the value is an `OidcError`.
 */
export function isOidcError(error: unknown): error is OidcError {
	return error instanceof OidcError;
}
