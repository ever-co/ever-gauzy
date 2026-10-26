import { createSign } from 'crypto';

/**
 * Activepieces managed authentication ("embedding"): the platform's owner signs a short-lived token with a signing key
 * of the platform (RS256, header `kid` = the signing key id), and `POST /v1/managed-authn/external-token` exchanges it
 * for a USER token of Activepieces, valid 7 days. On the way, Activepieces finds or creates the project whose external
 * id is `externalProjectId` and the user whose external id is `externalUserId`, and makes that user a member of that
 * project only. The token reaches the projects its user is a member of, and nothing else of the platform.
 *
 * Sources: https://www.activepieces.com/docs/embedding/provision-users and, in github.com/activepieces/activepieces,
 * `packages/server/api/src/app/ee/managed-authn/managed-authn-service.ts` and `lib/external-token-extractor.ts`.
 */

/** How long the token the server signs is valid: it is exchanged at once. */
export const EXTERNAL_TOKEN_LIFETIME_SECONDS = 5 * 60;

/** The project role the tenant's Activepieces user gets in its own project (`DefaultProjectRole.EDITOR`). */
export const EXTERNAL_TOKEN_PROJECT_ROLE = 'Editor';

/** The claims of the token the server signs (Activepieces' v2 payload: no piece set, the platform default applies). */
export interface IActivepiecesExternalTokenClaims {
	externalUserId: string;
	externalProjectId: string;
	firstName: string;
	lastName: string;
	role: string;
	iat: number;
	exp: number;
}

/**
 * The private key as Node reads it. An environment variable often carries a PEM key with its newlines escaped (`\n`)
 * or base64-encoded whole; both are accepted.
 *
 * @param raw - The configured private key.
 */
export function normalizePrivateKey(raw: string): string {
	const value = (raw ?? '').trim().replace(/\\n/g, '\n');
	if (value.includes('-----BEGIN')) {
		return value;
	}
	const decoded = Buffer.from(value, 'base64').toString('utf8');
	return decoded.includes('-----BEGIN') ? decoded.trim() : value;
}

/**
 * Signs the token Activepieces exchanges for a project token.
 *
 * @param keyId - The signing key id (`kid`).
 * @param privateKey - The signing key's private key (see {@link normalizePrivateKey}).
 * @param claims - The claims.
 * @returns The compact JWT. A credential: never log it.
 */
export function signExternalToken(keyId: string, privateKey: string, claims: IActivepiecesExternalTokenClaims): string {
	const header = { alg: 'RS256', typ: 'JWT', kid: keyId };
	const signingInput = `${base64Url(header)}.${base64Url(claims)}`;
	const signature = createSign('RSA-SHA256').update(signingInput).sign(normalizePrivateKey(privateKey));
	return `${signingInput}.${signature.toString('base64url')}`;
}

/**
 * The claims of the token for a tenant: one Activepieces user and one project per tenant, both named by the tenant's
 * external id. The user must never be shared between tenants: it is a member of every project it was ever exchanged
 * for, and its token reaches all of them.
 *
 * @param externalId - `<prefix><tenantId>`.
 * @param nowSeconds - The current time, in seconds.
 */
export function tenantExternalTokenClaims(externalId: string, nowSeconds: number): IActivepiecesExternalTokenClaims {
	return {
		externalUserId: externalId,
		externalProjectId: externalId,
		firstName: 'Ever Gauzy',
		lastName: 'Tenant',
		role: EXTERNAL_TOKEN_PROJECT_ROLE,
		iat: nowSeconds,
		exp: nowSeconds + EXTERNAL_TOKEN_LIFETIME_SECONDS
	};
}

/**
 * When a JWT expires, from its `exp` claim, without checking its signature (the server only uses it to know when to
 * obtain a new one).
 *
 * @param token - A compact JWT.
 * @returns The expiry in milliseconds since the epoch, or `null` when the token states none.
 */
export function readJwtExpiry(token: string): number | null {
	const payload = typeof token === 'string' ? token.split('.')[1] : undefined;
	if (!payload) {
		return null;
	}
	try {
		const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
		return typeof claims?.exp === 'number' && Number.isFinite(claims.exp) ? claims.exp * 1000 : null;
	} catch {
		return null;
	}
}

function base64Url(value: unknown): string {
	return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}
