import { createHash, randomBytes } from 'node:crypto';

/**
 * Encodes bytes as base64url without padding (RFC 4648 section 5), as PKCE and JOSE require.
 *
 * @param input - The bytes to encode.
 * @returns The base64url text.
 */
export function base64UrlEncode(input: Buffer): string {
	return input.toString('base64url');
}

/**
 * Returns `size` cryptographically random bytes as base64url text.
 *
 * @param size - Number of random bytes (32 by default, giving 43 characters).
 * @returns The random value.
 */
export function randomBase64Url(size = 32): string {
	return base64UrlEncode(randomBytes(size));
}

/**
 * Creates a PKCE code verifier: 32 random bytes, base64url, 43 characters (RFC 7636 section 4.1).
 *
 * @returns The code verifier.
 */
export function createCodeVerifier(): string {
	return randomBase64Url(32);
}

/**
 * Derives the S256 code challenge of a verifier: base64url(SHA-256(ASCII(verifier))) (RFC 7636 section 4.2).
 *
 * @param verifier - The code verifier.
 * @returns The code challenge.
 */
export function createCodeChallenge(verifier: string): string {
	return base64UrlEncode(createHash('sha256').update(verifier, 'ascii').digest());
}
