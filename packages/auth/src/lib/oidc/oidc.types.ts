/**
 * Public types of the shared OpenID Connect client library.
 *
 * The library knows nothing about any particular identity provider: a provider plugin builds an
 * {@link OidcIssuerConfig} from its own settings and passes it to every call.
 */

/** Signature algorithms the library accepts. Symmetric (`HS*`) algorithms and `none` are never accepted. */
export const OIDC_SIGNING_ALGORITHMS = ['RS256', 'ES256', 'EdDSA'] as const;

/** One of {@link OIDC_SIGNING_ALGORITHMS}. */
export type OidcSigningAlgorithm = (typeof OIDC_SIGNING_ALGORITHMS)[number];

/** The OpenID Provider metadata fields the library reads (OpenID Connect Discovery 1.0, section 3). */
export interface OidcDiscoveryDocument {
	issuer: string;
	authorization_endpoint: string;
	token_endpoint: string;
	jwks_uri: string;
	userinfo_endpoint?: string;
	end_session_endpoint?: string;
	[key: string]: unknown;
}

/** Everything the library needs to talk to one issuer on behalf of one client. */
export interface OidcIssuerConfig {
	/** Exact issuer identifier, compared byte for byte with the `iss` claim (no trailing slash). */
	issuer: string;
	/** The OAuth client id registered at the issuer. */
	clientId: string;
	/** Confidential client secret. When absent the client is public and relies on PKCE alone. */
	clientSecret?: string;
	/** Redirect URI registered for the client. */
	redirectUri: string;
	/** Scopes to request. The library never adds a scope of its own. */
	scopes: string[];
	/** Extra `aud` / `azp` values accepted besides `clientId` (e.g. other first-party clients). */
	audienceAllowList?: string[];
	/** A pre-loaded discovery document (tests); fetched from the issuer when absent. */
	discoveryDocument?: OidcDiscoveryDocument;
}

/** The state of one authorization request, kept in a signed cookie between the start and the callback. */
export interface OidcTransaction {
	/** Issuer the request was sent to. */
	issuer: string;
	/** Opaque `state` value echoed back by the issuer. */
	state: string;
	/** `nonce` the ID token must carry. */
	nonce: string;
	/** PKCE code verifier. */
	codeVerifier: string;
	/** Caller-defined purpose of the request (for example `signin` or `link`). */
	mode: string;
	/** Caller-defined data bound to the request (never secrets). */
	payload?: Record<string, string>;
	/** Creation time, milliseconds since the epoch. */
	createdAt: number;
}

/** Options of {@link OidcTransactionService.begin}. */
export interface OidcBeginOptions {
	issuer: string;
	mode: string;
	payload?: Record<string, string>;
}

/** How the transaction cookie is written. */
export interface OidcTransactionCookieOptions {
	/** Cookie name. Each provider plugin uses its own, so two flows never clobber each other. */
	name: string;
	/** Whether to mark the cookie `Secure` (true when the API is served over https). */
	secure: boolean;
	/** Cookie path, `/api/auth` by default. */
	path?: string;
}

/** Optional authorization request parameters. */
export interface OidcAuthorizeOptions {
	prompt?: 'login' | 'create' | 'none';
	/** Only ever set from a value the person typed into the product; never derived from stored data. */
	loginHint?: string;
	/** Maximum authentication age in seconds. */
	maxAge?: number;
}

/** A verified, normalised ID token. */
export interface OidcValidatedIdToken {
	issuer: string;
	subject: string;
	audience: string[];
	azp?: string;
	sid?: string;
	email?: string;
	/** `true` only when the token carries `email_verified: true`; a missing claim reads as `false`. */
	emailVerified: boolean;
	name?: string;
	givenName?: string;
	familyName?: string;
	picture?: string;
	/** `auth_time` in seconds since the epoch, when present. */
	authTime?: number;
	iat: number;
	exp: number;
	/** The full verified payload, for provider-specific hints. */
	claims: Record<string, unknown>;
}

/** Result of a successful authorization code exchange. */
export interface OidcCodeExchangeResult {
	idToken: OidcValidatedIdToken;
	/** Returned for completeness; callers must not persist it. */
	accessToken?: string;
	/** Returned for completeness; callers must not persist it. */
	refreshToken?: string;
	expiresIn?: number;
}

/** Options of {@link OidcClientService.validateIdToken}. */
export interface OidcIdTokenValidationOptions {
	/** Expected `nonce`; compared when given. */
	nonce?: string;
	/**
	 * Audiences accepted for this call. Defaults to the issuer config's `clientId` plus its
	 * `audienceAllowList`.
	 */
	audiences?: string[];
	/** Largest accepted distance of `iat` into the future, seconds. Defaults to 300. */
	maxIatSkewSeconds?: number;
}

/** A verified back-channel logout token (OpenID Connect Back-Channel Logout 1.0). */
export interface OidcLogoutToken {
	issuer: string;
	subject?: string;
	sid?: string;
	jti: string;
	iat: number;
	/** Member names of the `events` claim. */
	events: string[];
}
