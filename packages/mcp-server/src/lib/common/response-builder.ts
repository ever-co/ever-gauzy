/**
 * Response Builder
 *
 * Standardized response building utility following KISS principle
 * Ensures consistent response formats across all endpoints
 */

import { Response } from 'express';
import { SecurityLogger } from './security-logger';

export interface TokenResponse {
	access_token: string;
	token_type: string;
	expires_in: number;
	refresh_token?: string;
	scope?: string;
}

export interface IntrospectionResponse {
	active: boolean;
	scope?: string;
	client_id?: string;
	username?: string;
	token_type?: string;
	exp?: number;
	iat?: number;
	nbf?: number;
	sub?: string;
	aud?: string | string[];
	iss?: string;
	jti?: string;
}

export interface SuccessRedirectResponse {
	redirectUrl: string;
	state?: string;
}

export interface JWKSKey {
	kty: string; // Key Type
	use?: string; // Public Key Use
	key_ops?: string[]; // Key Operations
	alg?: string; // Algorithm
	kid?: string; // Key ID
	x5u?: string; // X.509 URL
	x5c?: string[]; // X.509 Certificate Chain
	x5t?: string; // X.509 Certificate SHA-1 Thumbprint
	'x5t#S256'?: string; // X.509 Certificate SHA-256 Thumbprint

	// RSA Key Parameters
	n?: string; // Modulus
	e?: string; // Exponent
	d?: string; // Private Exponent
	p?: string; // First Prime Factor
	q?: string; // Second Prime Factor
	dp?: string; // First Factor CRT Exponent
	dq?: string; // Second Factor CRT Exponent
	qi?: string; // First CRT Coefficient
	oth?: Array<{
		r?: string; // Prime Factor
		d?: string; // Factor CRT Exponent
		t?: string; // Factor CRT Coefficient
	}>;

	// Elliptic Curve Key Parameters
	crv?: string; // Curve
	x?: string; // X Coordinate
	y?: string; // Y Coordinate

	// Symmetric Key Parameters
	k?: string; // Key Value
}

export interface JWKSResponse {
	keys: JWKSKey[];
}

export interface ServerMetadata {
	issuer: string;
	authorization_endpoint?: string;
	token_endpoint?: string;
	jwks_uri?: string;
	registration_endpoint?: string;
	introspection_endpoint?: string;
	userinfo_endpoint?: string;
	scopes_supported?: string[];
	response_types_supported?: string[];
	grant_types_supported?: string[];
	code_challenge_methods_supported?: string[];
	token_endpoint_auth_methods_supported?: string[];
	revocation_endpoint_auth_methods_supported?: string[];
}

export interface ResourceMetadata {
	resource: string;
	authorization_servers?: string[];
}

export interface UserInfoResponse {
	sub: string; // Subject - Identifier for the End-User
	name?: string;
	given_name?: string;
	family_name?: string;
	middle_name?: string;
	nickname?: string;
	preferred_username?: string;
	profile?: string;
	picture?: string;
	website?: string;
	email?: string;
	email_verified?: boolean;
	gender?: string;
	birthdate?: string;
	zoneinfo?: string;
	locale?: string;
	phone_number?: string;
	phone_number_verified?: boolean;
	address?: {
		formatted?: string;
		street_address?: string;
		locality?: string;
		region?: string;
		postal_code?: string;
		country?: string;
	};
	updated_at?: number;
	// Custom claims
	organization_id?: string;
	tenant_id?: string;
	roles?: string[];
}

export interface ClientRegistrationResponse {
	client_id: string;
	client_secret?: string;
	client_name: string;
	client_type: 'confidential' | 'public';
	redirect_uris: string[];
	grant_types: string[];
	response_types: string[];
	scope: string;
	logo_uri?: string;
	client_uri?: string;
	policy_uri?: string;
	tos_uri?: string;
	client_id_issued_at: number;
	client_secret_expires_at?: number;
}

export class ResponseBuilder {
	private securityLogger: SecurityLogger;

	constructor() {
		this.securityLogger = new SecurityLogger();
	}

	/**
	 * Send OAuth 2.0 token response with proper headers
	 */
	sendTokenResponse(res: Response, tokenData: TokenResponse): void {
		this.securityLogger.debug('Sending token response', {
			token_type: tokenData.token_type,
			expires_in: tokenData.expires_in,
			has_refresh_token: !!tokenData.refresh_token,
			scope: tokenData.scope
		});

		res.setHeader('Cache-Control', 'no-store');
		res.setHeader('Pragma', 'no-cache');
		res.setHeader('Content-Type', 'application/json');

		res.json(tokenData);
	}

	/**
	 * Send token introspection response
	 */
	sendIntrospectionResponse(res: Response, introspectionData: IntrospectionResponse): void {
		this.securityLogger.debug('Sending introspection response', {
			active: introspectionData.active,
			client_id: introspectionData.client_id,
			scope: introspectionData.scope
		});

		res.setHeader('Content-Type', 'application/json');
		res.json(introspectionData);
	}

	/**
	 * Send successful authorization redirect
	 */
	sendAuthorizationRedirect(res: Response, redirectUri: string, code: string, state?: string): void {
		try {
			const url = new URL(redirectUri);
			url.searchParams.set('code', code);
			if (state) {
				url.searchParams.set('state', state);
			}

			this.securityLogger.debug('Sending authorization redirect', {
				redirect_uri_host: url.hostname,
				has_state: !!state,
				code_length: code.length
			});

			res.redirect(303, url.toString());
		} catch (error) {
			this.securityLogger.error('Failed to build authorization redirect URL', { error, redirectUri });
			res.status(400).json({
				error: 'invalid_redirect_uri',
				error_description: 'Invalid redirect URI format'
			});
		}
	}

	/**
	 * Send JWKS response
	 */
	sendJwksResponse(res: Response, jwks: JWKSResponse): void {
		this.securityLogger.debug('Sending JWKS response', {
			key_count: jwks.keys?.length || 0
		});

		res.setHeader('Content-Type', 'application/json');
		res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
		res.json(jwks);
	}

	/**
	 * Send OAuth 2.0 server metadata
	 */
	sendServerMetadata(res: Response, metadata: ServerMetadata): void {
		this.securityLogger.debug('Sending server metadata', {
			issuer: metadata.issuer,
			endpoints: Object.keys(metadata).filter(key => key.endsWith('_endpoint')).length
		});

		res.setHeader('Content-Type', 'application/json');
		res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
		res.json(metadata);
	}

	/**
	 * Send protected resource metadata (RFC 9728)
	 */
	sendResourceMetadata(res: Response, metadata: ResourceMetadata): void {
		this.securityLogger.debug('Sending resource metadata', {
			resource: metadata.resource,
			authorization_servers_count: metadata.authorization_servers?.length || 0
		});

		res.setHeader('Content-Type', 'application/json');
		res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
		res.json(metadata);
	}

	/**
	 * Send user info response (OpenID Connect)
	 */
	sendUserInfoResponse(res: Response, userInfo: UserInfoResponse): void {
		this.securityLogger.debug('Sending user info response', {
			sub: userInfo.sub,
			has_email: !!userInfo.email,
			has_profile: !!userInfo.name
		});

		res.setHeader('Content-Type', 'application/json');
		res.setHeader('Cache-Control', 'no-store');
		res.setHeader('Pragma', 'no-cache');
		res.json(userInfo);
	}

	/**
	 * Send client registration response
	 */
	sendClientRegistrationResponse(res: Response, clientData: ClientRegistrationResponse): void {
		this.securityLogger.debug('Sending client registration response', {
			client_id: clientData.client_id,
			client_type: clientData.client_type,
			grant_types: clientData.grant_types
		});

		res.setHeader('Content-Type', 'application/json');
		res.status(201).json(clientData);
	}

	/**
	 * Send success response with optional data
	 */
	sendSuccess(res: Response, data?: any, statusCode: number = 200): void {
		res.status(statusCode);
		if (data) {
			res.setHeader('Content-Type', 'application/json');
			res.json(data);
		} else {
			res.end();
		}
	}

	/**
	 * Send HTML response (for login/consent pages)
	 */
	sendHtml(res: Response, html: string): void {
		res.setHeader('Content-Type', 'text/html; charset=utf-8');
		res.setHeader('X-Frame-Options', 'DENY');
		res.setHeader('X-Content-Type-Options', 'nosniff');
		res.send(html);
	}

	/**
	 * Set security headers for all responses
	 */
	static setSecurityHeaders(res: Response): void {
		res.setHeader('X-Content-Type-Options', 'nosniff');
		res.setHeader('X-Frame-Options', 'DENY');
		res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
		res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
	}
}
