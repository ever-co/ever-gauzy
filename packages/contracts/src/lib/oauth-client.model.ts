/**
 * Contract for the multi-app OAuth client registry.
 *
 * Added as part of the single-app → multi-app OAuth refactor.
 * In the previous (single-app) implementation, the one and only OAuth client
 * was hardcoded via `GAUZY_OAUTH_APP_CLIENT_*` env vars and shared by every
 * third-party integration (Activepieces). This contract describes a real
 * registry row so each third party (Activepieces, n8n, Make.com, …) gets
 * isolated credentials, redirect URIs, and scopes.
 */

import { IBasePerTenantEntityModel, ID } from './base-entity.model';

/**
 * Confidential clients can keep a secret (server-to-server). Public clients
 * (SPAs, mobile) cannot, and must use PKCE — PKCE itself is deferred to a
 * later phase, but the column is reserved on the entity now.
 */
export enum OAuthClientType {
	CONFIDENTIAL = 'confidential',
	PUBLIC = 'public'
}

/**
 * Grant types this provider may support per client. Today only
 * `authorization_code` is implemented end-to-end; the others are reserved
 * so the registry shape doesn't need a migration when they ship.
 */
export enum OAuthGrantType {
	AUTHORIZATION_CODE = 'authorization_code',
	REFRESH_TOKEN = 'refresh_token',
	CLIENT_CREDENTIALS = 'client_credentials'
}

export interface IOAuthClient extends IBasePerTenantEntityModel {
	/** Public client identifier exposed to third parties (e.g. `gauzy_<base64url>`). */
	clientId: string;

	/** Human-readable name shown on the consent screen ("Activepieces", "n8n"). */
	name: string;

	/** Optional short description rendered on the consent screen. */
	description?: string | null;

	/** Confidential vs public — controls whether a secret is required. */
	clientType: OAuthClientType;

	/** Allowlisted redirect URIs for the authorization code flow. */
	redirectUris: string[];

	/** OAuth scopes this client may request. */
	allowedScopes: string[];

	/** Grant types this client is allowed to use. */
	allowedGrantTypes: OAuthGrantType[];

	/** PKCE requirement (reserved — enforcement ships in a later phase). */
	pkceRequired: boolean;

	/**
	 * Per-client access token TTL in seconds. Stored on the entity now so
	 * the registry shape is final, but enforcement is deferred — today's
	 * token issuance still uses the global `JWT_TOKEN_EXPIRATION_TIME`.
	 */
	accessTokenTtl: number;

	/** Per-client refresh token TTL in seconds (reserved, see above). */
	refreshTokenTtl: number;
}

/** DTO returned by `POST /oauth/clients` — contains the plaintext secret ONCE. */
export interface IOAuthClientWithSecret extends IOAuthClient {
	/**
	 * Plaintext client secret. Returned exactly once on creation and on
	 * `POST /oauth/clients/:id/rotate-secret`. Never persisted in plaintext
	 * and never returned by any read endpoint.
	 */
	clientSecret: string;
}

export interface IOAuthClientCreateInput {
	name: string;
	description?: string | null;
	clientType?: OAuthClientType;
	redirectUris: string[];
	allowedScopes?: string[];
	allowedGrantTypes?: OAuthGrantType[];
	pkceRequired?: boolean;
	accessTokenTtl?: number;
	refreshTokenTtl?: number;
	tenantId?: ID | null;
}

export interface IOAuthClientUpdateInput {
	name?: string;
	description?: string | null;
	redirectUris?: string[];
	allowedScopes?: string[];
	allowedGrantTypes?: OAuthGrantType[];
	pkceRequired?: boolean;
	accessTokenTtl?: number;
	refreshTokenTtl?: number;
	isActive?: boolean;
}
