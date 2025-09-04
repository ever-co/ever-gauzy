/**
 * Response Builder
 *
 * Standardized response building utility following KISS principle
 * Ensures consistent response formats across all endpoints
 */

import { Response } from 'express';
import { SecurityLogger } from './security-logger';
import {
	ClientRegistrationResponse,
	IntrospectionResponse,
	JWKSResponse,
	ResourceMetadata,
	ServerMetadata,
	TokenResponse,
	UserInfoResponse
} from './interfaces';

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

		res.setHeader('Cache-Control', 'no-store');
		res.setHeader('Pragma', 'no-cache');
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

			res.setHeader('Cache-Control', 'no-store');
			res.setHeader('Pragma', 'no-cache');
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
		// Sanitize: expose only public JWK members
		const sanitized = {
			keys: jwks.keys.map((k) => {
				const { kty, use, key_ops, alg, kid, x5u, x5c, x5t, n, e, crv, x, y } = k;
				const out: Record<string, unknown> = { kty, use, key_ops, alg, kid, x5u, x5c, x5t, n, e, crv, x, y };
				const x5tS256 = (k as any)['x5t#S256'] as string | undefined;
				if (x5tS256) out['x5t#S256'] = x5tS256;
				return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined));
			})
		};
		res.json(sanitized);
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

		res.setHeader('Cache-Control', 'no-store');
		res.setHeader('Pragma', 'no-cache');
		res.setHeader('Content-Type', 'application/json');
		res.status(201).json(clientData);
	}

	/**
	 * Send success response with optional data
	 */
	sendSuccess<T>(res: Response, data?: T, statusCode = 200): void {
		res.status(statusCode);
		if ([204, 205, 304].includes(statusCode)) {
			res.end();
			return;
		}
		if (data !== undefined) {
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
		res.setHeader('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none'");
		res.send(html);
	}

	/**
	 * Set security headers for all responses
	 */
	static setSecurityHeaders(res: Response): void {
		res.setHeader('X-Content-Type-Options', 'nosniff');
		res.setHeader('X-Frame-Options', 'DENY');
		if (process.env.NODE_ENV === 'production') {
			res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
		}
		res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
		res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
		res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
	}
}
