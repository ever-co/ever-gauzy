import { createHash, randomBytes } from 'node:crypto';

/**
 * How many random bytes a guest-cart token carries: 256 bits, well past the 128 a bearer secret needs to
 * be unguessable, and 43 characters once it is base64url-encoded — short enough for a URL path segment.
 */
export const CART_TOKEN_BYTES = 32;

/**
 * Issues a guest-cart token.
 *
 * The token is the buyer's only handle on a cart they did not sign in to build, so it is a bearer secret:
 * random rather than derived from anything a caller could know (the cart id, the e-mail, a timestamp), and
 * encoded base64url so it travels in a path segment without escaping.
 *
 * @returns The plaintext token. It is answered once, by the create that issued it, and never stored.
 */
export function issueCartToken(): string {
	return randomBytes(CART_TOKEN_BYTES).toString('base64url');
}

/**
 * The digest a cart stores in place of its token.
 *
 * A database read therefore never yields a token that opens a cart: what is stored is the SHA-256 of the
 * token, and a lookup hashes what it was given and asks for that digest. A salt would buy nothing here —
 * the token is 256 random bits, not a password a dictionary could reach — and it would make the digest
 * impossible to look up by, which is the one thing it is for. Because the lookup is an equality on the
 * digest rather than a comparison of the token itself, there is no timing side channel to close either.
 *
 * @param token The plaintext token.
 * @returns The lower-case hex digest, 64 characters.
 */
export function digestCartToken(token: string): string {
	return createHash('sha256').update(String(token ?? ''), 'utf8').digest('hex');
}
