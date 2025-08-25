/**
 * OAuth 2.0 Token Validation Utilities
 *
 * This module provides utilities for validating OAuth 2.0 access tokens
 * according to RFC 6749, RFC 7662, and RFC 8707 specifications.
 */

import { Request } from 'express';
import { AuthorizationConfig, TokenValidationResult, AuthorizationError } from './authorization-config';
import { SecurityLogger } from './security-logger';

export class OAuthValidator {
	private tokenCache = new Map<string, { result: TokenValidationResult; expires: number }>();
	private securityLogger: SecurityLogger;

	constructor(private config: AuthorizationConfig) {
		this.securityLogger = new SecurityLogger();
	}

	/**
	 * Extract Bearer token from Authorization header
	 */
	extractBearerToken(req: Request): string | null {
		const authorization = req.headers.authorization;

		if (!authorization) {
			return null;
		}

		// RFC 6750 Section 2.1: Authorization Request Header Field
		const matches = authorization.match(/^Bearer\s+([^\s]+(?:\s+[^\s]+)*)$/i);
		if (!matches || !matches[1]) {
			return null;
		}

		return matches[1].trim();
	}

	/**
	 * Validate access token according to OAuth 2.0 specifications
	 */
	async validateToken(token: string, requiredScopes?: string[]): Promise<TokenValidationResult> {
		try {
			// Check cache first
			const cached = this.getCachedToken(token);
			if (cached) {
				this.securityLogger.debug('Token validation result retrieved from cache');
				return cached;
			}

			let result: TokenValidationResult;

			// Try JWT validation first if configured
			if (this.config.jwt?.publicKey || this.config.jwt?.jwksUri) {
				result = await this.validateJWT(token);
			}
			// Fall back to introspection if available
			else if (this.config.introspection) {
				result = await this.introspectToken(token);
			}
			// No validation method configured
			else {
				this.securityLogger.warn('No token validation method configured');
				result = {
					valid: false,
					error: 'Token validation not configured'
				};
			}

			// Validate required scopes if token is valid
			if (result.valid && requiredScopes && requiredScopes.length > 0) {
				const hasRequiredScopes = this.validateScopes(result.scopes || [], requiredScopes);
				if (!hasRequiredScopes) {
					result = {
						valid: false,
						error: 'Insufficient scope',
						payload: result.payload
					};
				}
			}

			// Validate audience claim (RFC 8707)
			if (result.valid && this.config.resourceUri) {
				const hasValidAudience = this.validateAudience(result.audience, this.config.resourceUri);
				if (!hasValidAudience) {
					result = {
						valid: false,
						error: 'Invalid audience claim',
						payload: result.payload
					};
				}
			}

			// Cache the result
			this.cacheToken(token, result);

			return result;
		} catch (error: unknown) {
			this.securityLogger.error('Token validation error:', error as Error);
			return {
				valid: false,
				error: error instanceof Error ? error.message : 'Token validation failed'
			};
		}
	}

	/**
	 * Validate JWT token (RFC 7519)
	 */
	private async validateJWT(token: string): Promise<TokenValidationResult> {
		try {
			// This is a simplified implementation
			// In production, you should use a proper JWT library like 'jsonwebtoken' or 'jose'
			const [headerB64, payloadB64, signatureB64] = token.split('.');

			if (!headerB64 || !payloadB64 || !signatureB64) {
				return {
					valid: false,
					error: 'Invalid JWT format'
				};
			}

			// Decode payload (without verification for this example)
			const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString());

			// Check expiration
			if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
				return {
					valid: false,
					error: 'Token expired'
				};
			}

			// Check issuer if configured
			if (this.config.jwt?.issuer && payload.iss !== this.config.jwt.issuer) {
				return {
					valid: false,
					error: 'Invalid issuer'
				};
			}

			// Check audience if configured
			if (this.config.jwt?.audience) {
				const hasValidAudience = this.validateAudience(payload.aud, this.config.jwt.audience);
				if (!hasValidAudience) {
					return {
						valid: false,
						error: 'Invalid audience'
					};
				}
			}

			return {
				valid: true,
				payload,
				expires: payload.exp,
				scopes: payload.scope ? payload.scope.split(' ') : undefined,
				subject: payload.sub,
				clientId: payload.client_id,
				audience: payload.aud
			};

		} catch (error: any) {
			this.securityLogger.error('JWT validation error:', error);
			return {
				valid: false,
				error: 'JWT validation failed'
			};
		}
	}

	/**
	 * Introspect token using OAuth 2.0 Token Introspection (RFC 7662)
	 */
	private async introspectToken(token: string): Promise<TokenValidationResult> {
		if (!this.config.introspection) {
			return {
				valid: false,
				error: 'Token introspection not configured'
			};
		}

		try {
			const credentials = Buffer.from(
				`${this.config.introspection.clientId}:${this.config.introspection.clientSecret}`
			).toString('base64');

			const response = await fetch(this.config.introspection.endpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					'Authorization': `Basic ${credentials}`,
					'Accept': 'application/json'
				},
				body: new URLSearchParams({
					token: token,
					token_type_hint: 'access_token'
				}),
				// Abort after 5 seconds
				signal: (AbortSignal as any).timeout ? (AbortSignal as any).timeout(5000) : undefined
			});

			if (!response.ok) {
				return {
					valid: false,
					error: `Introspection failed: ${response.status} ${response.statusText}`
				};
			}

			const result = await response.json();

			if (!result.active) {
				return {
					valid: false,
					error: 'Token is not active'
				};
			}

			return {
				valid: true,
				payload: result,
				expires: result.exp,
				scopes: result.scope ? result.scope.split(' ') : undefined,
				subject: result.sub,
				clientId: result.client_id,
				audience: result.aud
			};

		} catch (error: any) {
			this.securityLogger.error('Token introspection error:', error);
			return {
				valid: false,
				error: 'Token introspection failed'
			};
		}
	}

	/**
	 * Validate that token has required scopes
	 */
	private validateScopes(tokenScopes: string[], requiredScopes: string[]): boolean {
		return requiredScopes.every(scope => tokenScopes.includes(scope));
	}

	/**
	 * Validate audience claim according to RFC 8707
	 */
	private validateAudience(tokenAudience: string | string[] | undefined, expectedAudience: string): boolean {
		if (!tokenAudience) {
			return false;
		}

		const audiences = Array.isArray(tokenAudience) ? tokenAudience : [tokenAudience];
		return audiences.includes(expectedAudience);
	}

	/**
	 * Cache token validation result
	 */
	private cacheToken(token: string, result: TokenValidationResult): void {
		if (!this.config.cache?.tokenTtl) {
			return;
		}

		const nowMs = Date.now();
		let ttlMs = this.config.cache.tokenTtl * 1000;
		if (typeof result.expires === 'number') {
			const tokenMs = Math.max(0, (result.expires * 1000) - nowMs);
			ttlMs = Math.min(ttlMs, tokenMs);
		}
		if (ttlMs <= 0) return;
		const expires = nowMs + ttlMs;
		this.tokenCache.set(token, { result, expires });

		// Clean up expired cache entries periodically
		if (this.tokenCache.size > 1000) {
			this.cleanupCache();
		}
	}

	/**
	 * Get cached token validation result
	 */
	private getCachedToken(token: string): TokenValidationResult | null {
		const cached = this.tokenCache.get(token);
		if (!cached) {
			return null;
		}

		if (Date.now() > cached.expires) {
			this.tokenCache.delete(token);
			return null;
		}

		return cached.result;
	}

	/**
	 * Clean up expired cache entries
	 */
	private cleanupCache(): void {
		const now = Date.now();
		for (const [token, cached] of this.tokenCache.entries()) {
			if (now > cached.expires) {
				this.tokenCache.delete(token);
			}
		}
	}

	/**
	 * Create OAuth 2.0 error response
	 */
	static createAuthorizationError(
		error: AuthorizationError['error'],
		description?: string,
		scope?: string,
		errorUri?: string
	): AuthorizationError {
		return {
			error,
			errorDescription: description,
			scope,
			errorUri
		};
	}

	/**
	 * Format WWW-Authenticate header for 401 responses (RFC 9728 Section 5.1)
	 */
	static formatWWWAuthenticateHeader(
		resourceMetadataUrl: string,
		error?: AuthorizationError
	): string {
		const esc = (v: string) => v.replace(/["\\]/g, '\\$&').replace(/[\r\n]/g, ' ');
		let header = `Bearer resource="${esc(resourceMetadataUrl)}"`;

		if (error) {
			header += `, error="${esc(error.error)}"`;

			if (error.errorDescription) {
				header += `, error_description="${esc(error.errorDescription)}"`;
			}

			if (error.errorUri) {
				header += `, error_uri="${esc(error.errorUri)}"`;
			}

			if (error.scope) {
				header += `, scope="${esc(error.scope)}"`;
			}
		}

		return header;
	}
}
