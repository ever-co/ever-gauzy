import { createHash } from 'node:crypto';

/**
 * The verified Ever ID behind a "create your workspace" hand-off: what this plugin read from an ID
 * token it verified with the shared OpenID Connect library, kept server-side under an opaque one-time
 * key. Never the token itself.
 */
export interface ZitadelProvisionHandoff {
	/** The issuer the token was verified against (one of the configured Ever ID issuers). */
	issuer: string;
	/** The identity's `sub` at that issuer. */
	subject: string;
	/** The verified e-mail of the identity (the token's `email`, with `email_verified: true`). */
	email: string;
	givenName?: string;
	familyName?: string;
	/**
	 * The SHA-256 (lower-case hex) of the provisioning key the sign-in was started with (the key of the
	 * pending request); the key itself is not kept.
	 */
	provisionKeyHash: string;
	/** Unix milliseconds of the sign-in. */
	signedInAt: number;
}

/**
 * Lets a connected-instance plugin read the Ever ID that signed in to confirm a workspace it is asked
 * to create, and sign that person in to the workspace once it exists. Provided by this plugin under
 * {@link ZITADEL_HANDOFF_READER} when it is loaded; a consumer injects it as optional and answers 404
 * while it is absent.
 *
 * - `peek`: the hand-off behind `handoffKey`, without using it up (`null`: unknown or expired);
 * - `consume`: the same, used up (a second call answers `null`);
 * - `signIn`: uses the hand-off up and answers a new one-time sign-in key for `userId` (the key of
 *   `#/auth/ever-id?handoff=…`), or `null` when the hand-off is gone or the user cannot sign in (the
 *   hand-off then stays usable).
 *
 * Hand-offs are stored under the SHA-256 of their key, with only the digest of the provisioning key.
 */
export interface ZitadelHandoffReaderPort {
	peek(handoffKey: string): Promise<ZitadelProvisionHandoff | null>;
	consume(handoffKey: string): Promise<ZitadelProvisionHandoff | null>;
	signIn(handoffKey: string, userId: string): Promise<string | null>;
}

/** Injection token of {@link ZitadelHandoffReaderPort}. Declared here; never imported the other way. */
export const ZITADEL_HANDOFF_READER = 'ZITADEL_HANDOFF_READER';

/** The shape of a provisioning key (the opaque key of a pending request: 43 base64url characters). */
export const PROVISION_KEY_SHAPE = /^[A-Za-z0-9_-]{43}$/;

/** The SHA-256 (lower-case hex) of a provisioning key, as hand-offs and pending requests keep it. */
export function provisionKeyHash(provisionKey: string): string {
	return createHash('sha256').update(provisionKey, 'utf8').digest('hex');
}
