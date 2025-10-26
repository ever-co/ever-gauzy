/**
 * OAuth 2.0 Token Validation Utilities
 *
 * This module provides utilities for validating OAuth 2.0 access tokens
 * according to RFC 6749, RFC 7662, and RFC 8707 specifications.
 */

import { Request } from 'express';
import { AuthorizationConfig, TokenValidationResult, AuthorizationError } from '../interfaces';
import { SecurityLogger } from '../utils';

// Dynamic import type for jose library
// Module usage: createRemoteJWKSet, jwtVerify
import type { JWTPayload as JoseJWTPayload } from 'jose';
type JoseModule = typeof import('jose');

export class OAuthValidator {
	private tokenCache = new Map<string, { result: TokenValidationResult; expires: number }>();
	private securityLogger: SecurityLogger;
	private josePromise: Promise<JoseModule> | null = null;

	constructor(private config: AuthorizationConfig) {
		this.securityLogger = new SecurityLogger();
	}

	/**
	 * Dynamically import jose library to handle ESM compatibility
	 */
	private async getJose(): Promise<JoseModule> {
		if (!this.josePromise) {
			this.josePromise = import('jose').catch((err) => {
				this.josePromise = null;
				throw err;
			});
		}
		return this.josePromise;
	}

	/**
	 * Normalize scopes from various formats to string array
	 */
	private normalizeScopes(value: any): string[] {
		if (!value) return [];
		if (Array.isArray(value)) return value.map(String);
		if (typeof value === 'string') return value.split(/\s+/).filter(Boolean);
		return [];
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
		const [scheme, token] = authorization.split(/\s+/, 2);
		if (!scheme || !/^Bearer$/i.test(scheme) || !token || /\s/.test(token)) {
			return null;
		}
		return token.trim();
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
			if (this.config.jwt?.jwksUri) {
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

			// Validate audience claim (RFC 8707); skip if already enforced via jwt.audience
			if (result.valid && this.config.resourceUri && !this.config.jwt?.audience) {
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
			if (result.valid) {
				this.cacheToken(token, result);
			}

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
	 * Validate JWT token using production libraries (RFC 7519)
	 */
	private async validateJWT(token: string): Promise<TokenValidationResult> {
		try {
			const jose = await this.getJose();
			type JWTPayload = JoseJWTPayload;
			let payload: JWTPayload | undefined;

			// Validate using JWKS URI (required)
			if (!this.config.jwt?.jwksUri) {
				return {
					valid: false,
					error: 'JWT validation not configured - JWKS URI required'
				};
			}

			const JWKS = jose.createRemoteJWKSet(new URL(this.config.jwt.jwksUri), {
				timeoutDuration: 5000,
				cooldownDuration: 30000
			});

			const { payload: josePayload } = await jose.jwtVerify(token, JWKS, {
				issuer: this.config.jwt.issuer,
				audience: this.config.jwt.audience,
				algorithms: this.config.jwt.algorithms as string[],
				clockTolerance: 30
			});

			payload = josePayload;
			this.securityLogger.debug('JWT validated using JWKS');

			// Additional validations
			const now = Math.floor(Date.now() / 1000);

			// Check expiration
			if (payload.exp && payload.exp < now) {
				return {
					valid: false,
					error: 'Token expired'
				};
			}

			// Check not before
			if (payload.nbf && payload.nbf > now) {
				return {
					valid: false,
					error: 'Token not yet valid'
				};
			}

			// Validate audience claim (RFC 8707)
			if (this.config.jwt?.audience) {
				const hasValidAudience = this.validateAudience(payload.aud, this.config.jwt.audience);
				if (!hasValidAudience) {
					return {
						valid: false,
						error: 'Invalid audience claim'
					};
				}
			}

			// Parse scopes from scope claim
			const scopeFromScope = this.normalizeScopes(payload.scope);
			const scopeFromScp = this.normalizeScopes(payload.scp);
			// Prefer 'scope' claim, but merge both if available
			const scopes = Array.from(new Set([...scopeFromScope, ...scopeFromScp]));

			return {
				valid: true,
				payload,
				expires: payload.exp,
				scopes,
				subject: payload.sub,
				clientId: (payload.client_id as string) || (payload.cid as string),
				audience: payload.aud
			};
		} catch (error: any) {
			this.securityLogger.error('JWT validation error:', error);
			return {
				valid: false,
				error: error.message || 'JWT validation failed'
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
			const hasSecret = !!this.config.introspection.clientSecret;
			const headers: Record<string, string> = {
				'Content-Type': 'application/x-www-form-urlencoded',
				'Accept': 'application/json'
			};
			if (hasSecret) {
				const credentials = Buffer.from(
					`${this.config.introspection.clientId}:${this.config.introspection.clientSecret}`
				).toString('base64');
				headers['Authorization'] = `Basic ${credentials}`;
			}

			const body = new URLSearchParams({
				token,
				token_type_hint: 'access_token',
			});
			if (!hasSecret) {
				body.set('client_id', this.config.introspection.clientId);
			}

			const response = await fetch(this.config.introspection.endpoint, {
				method: 'POST',
				headers,
				body,
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

			// Parse scopes from introspection response
			const scopeFromScope = this.normalizeScopes(result.scope);
			const scopeFromScp = this.normalizeScopes(result.scp);
			// Prefer 'scope' claim, but merge both if available
			const scopes = scopeFromScope.length > 0 ? scopeFromScope : scopeFromScp.length > 0 ? scopeFromScp : [];

			return {
				valid: true,
				payload: result,
				expires: result.exp,
				scopes,
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
		return requiredScopes.every((scope) => tokenScopes.includes(scope));
	}

	/**
	 * Validate audience claim according to RFC 8707
	 */
	private validateAudience(tokenAudience: string | string[] | undefined, expectedAudience: string): boolean {
		if (!tokenAudience) {
			return false;
		}

		const norm = (v: string) => v.replace(/\/+$/, '');
		const audiences = (Array.isArray(tokenAudience) ? tokenAudience : [tokenAudience]).map(String).map(norm);
		return audiences.includes(norm(expectedAudience));
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
			const tokenMs = Math.max(0, result.expires * 1000 - nowMs);
			ttlMs = Math.min(ttlMs, tokenMs);
		}
		if (ttlMs <= 0) return;
		const expires = nowMs + ttlMs;
		this.tokenCache.set(token, { result, expires });

		// Clean up expired cache entries and enforce a soft cap
		if (this.tokenCache.size > 1000) {
			this.cleanupCache();
			if (this.tokenCache.size > 5000) {
				// Evict oldest entries (FIFO)
				const overshoot = this.tokenCache.size - 5000;
				let i = 0;
				for (const key of this.tokenCache.keys()) {
					this.tokenCache.delete(key);
					if (++i >= overshoot) break;
				}
			}
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

		// LRU touch
		this.tokenCache.delete(token);
		this.tokenCache.set(token, cached);
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
	static formatWWWAuthenticateHeader(resourceMetadataUrl: string, error?: AuthorizationError): string {
		const esc = (v: string) => v.replace(/["\\]/g, '\\$&').replace(/[\r\n]/g, ' ');
		let header = `Bearer resource_metadata="${esc(resourceMetadataUrl)}"`;

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
