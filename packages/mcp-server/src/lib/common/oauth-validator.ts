/**
 * OAuth 2.0 Token Validation Utilities
 *
 * This module provides utilities for validating OAuth 2.0 access tokens
 * according to RFC 6749, RFC 7662, and RFC 8707 specifications.
 */

import { Request } from 'express';
import { AuthorizationConfig, TokenValidationResult, AuthorizationError } from './authorization-config';
import { SecurityLogger } from './security-logger';
import * as crypto from 'node:crypto';
import { TextEncoder } from 'node:util';

// Dynamic import type for jose library
// Module usage: createRemoteJWKSet, jwtVerify, importSPKI, importJWK, importX509
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
	 * Detect the key type from PEM data and map to appropriate JOSE algorithm
	 */
	private detectKeyTypeAndAlgorithm(keyData: string, configuredAlg: string): string {
		try {
			const publicKey = crypto.createPublicKey(keyData);
			const keyType = publicKey.asymmetricKeyType;

			// Map key types to JOSE algorithms
			switch (keyType) {
				case 'rsa':
					// Keep configured RS*/PS* if provided, otherwise default to RS256
					return /^RS\d+$/.test(configuredAlg) || /^PS\d+$/.test(configuredAlg) ? configuredAlg : 'RS256';
				case 'rsa-pss':
					// RSA-PSS keys should use PS* algorithms
					return /^PS\d+$/.test(configuredAlg) ? configuredAlg : 'PS256';
				case 'ec':
					// Keep configured ES* if provided, otherwise default to ES256 (fallbacks will try ES384/ES512)
					return /^ES(256K|256|384|512)$/.test(configuredAlg) ? configuredAlg : 'ES256';
				case 'dsa':
				this.securityLogger.warn('DSA keys are not supported for JOSE/JWT. Falling back to configured algorithm.');
					return configuredAlg;
				case 'x25519':
				case 'x448':
					this.securityLogger.warn(`${keyType} is a key-agreement type, not suitable for JWT signatures. Falling back to configured algorithm.`);
					return configuredAlg;
				case 'ed25519':
				case 'ed448':
					return 'EdDSA';
				default:
					this.securityLogger.warn(`Unknown key type: ${keyType}, using configured algorithm: ${configuredAlg}`);
					return configuredAlg;
			}
		} catch (error: any) {
			this.securityLogger.warn(`Failed to detect key type: ${error.message}, using configured algorithm: ${configuredAlg}`);
			return configuredAlg;
		}
	}

	/**
	 * Attempt to import SPKI with fallback algorithms if initial attempt fails
	 */
	private async importSPKIWithFallback(
		jose: JoseModule,
		keyData: string,
		primaryAlg: string
	): Promise<any> {
		const fallbackAlgorithms = [
			'RS256','RS384','RS512',
			'PS256','PS384','PS512',
			'ES256','ES384','ES512','ES256K',
			'EdDSA'
		];
		const attemptOrder = [primaryAlg, ...fallbackAlgorithms.filter(alg => alg !== primaryAlg)];

		let lastError: Error | null = null;

		for (const alg of attemptOrder) {
			try {
				return await jose.importSPKI(keyData, alg);
			} catch (error: any) {
				lastError = error;
				this.securityLogger.debug(`Failed to import SPKI with algorithm ${alg}: ${error.message}`);
			}
		}

		throw lastError || new Error('All SPKI import attempts failed');
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

			// Try JWKS URI first (recommended for production)
			if (this.config.jwt?.jwksUri) {
				try {
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
				} catch (jwksError: any) {
					this.securityLogger.warn('JWKS validation failed, trying local key:', jwksError.message);

					// Fall back to local public key validation
					if (!this.config.jwt?.publicKey) {
						throw jwksError;
					}
				}
			}

			// Use local public key if JWKS failed or not configured
			if (!payload && this.config.jwt?.publicKey) {
				try {
					// Convert public key to jose KeyLike
					let publicKey: any;
					const keyData = this.config.jwt.publicKey;

					// Determine if key is PEM, JWK, or raw secret (HS*)
					const configuredAlg = this.config.jwt?.algorithms?.[0] || 'RS256';
					let headerAlg: string | undefined;
					try { headerAlg = jose.decodeProtectedHeader(token)?.alg as string | undefined; } catch { /* ignore */ }
					if (keyData.startsWith('-----BEGIN CERTIFICATE')) {
						const primaryAlg = headerAlg || this.detectKeyTypeAndAlgorithm(keyData, configuredAlg);
						publicKey = await jose.importX509(keyData, primaryAlg);
					} else if (keyData.startsWith('-----BEGIN')) {
						// PEM SPKI format
						const mappedAlg = this.detectKeyTypeAndAlgorithm(keyData, configuredAlg);
						publicKey = await this.importSPKIWithFallback(jose, keyData, headerAlg || mappedAlg);
					} else {
						try {
							// Try to parse as JWK
							const jwk = JSON.parse(keyData);
							// Derive algorithm from JWK if not provided
							let jwkAlg = jwk.alg as string | undefined;
							if (!jwkAlg) {
								switch (jwk.kty) {
									case 'RSA':
										jwkAlg = /^PS\d+$/.test(configuredAlg) ? configuredAlg : 'RS256';
										break;
									case 'EC':
										switch (jwk.crv) {
											case 'P-256': jwkAlg = 'ES256'; break;
											case 'P-384': jwkAlg = 'ES384'; break;
											case 'P-521': jwkAlg = 'ES512'; break;
											case 'secp256k1': jwkAlg = 'ES256K'; break;
											default: jwkAlg = 'ES256';
										}
										break;
									case 'OKP':
										// Ed25519/Ed448 used for EdDSA
										jwkAlg = 'EdDSA';
										break;
									case 'oct':
										jwkAlg = /^HS\d+$/.test(configuredAlg) ? configuredAlg : 'HS256';
										break;
									default:
										throw new Error(`Unsupported JWK key type: ${jwk.kty}`);
								}
							}
							publicKey = await jose.importJWK(jwk, jwkAlg);
						} catch {
							// Not JSON: if HS*, treat as shared secret; otherwise assume PEM-like SPKI
							if (/^HS\d+$/.test(configuredAlg)) {
								publicKey = new TextEncoder().encode(keyData);
							} else {
								const mappedAlg = this.detectKeyTypeAndAlgorithm(keyData, configuredAlg);
								publicKey = await this.importSPKIWithFallback(jose, keyData, headerAlg || mappedAlg);
							}
						}
					}

					// Verify using jose
					const { payload: josePayload } = await jose.jwtVerify(token, publicKey, {
						issuer: this.config.jwt.issuer,
						audience: this.config.jwt.audience,
						algorithms: this.config.jwt?.algorithms ?? (headerAlg ? [headerAlg] : undefined),
						clockTolerance: 30
					});
					payload = josePayload;
					this.securityLogger.debug('JWT validated using local public key');
				} catch (keyError: any) {
					this.securityLogger.error('Local key validation failed:', keyError.message);
					return {
						valid: false,
						error: `JWT validation failed: ${keyError.message}`
					};
				}
			}

			// If no validation method worked
			if (!payload) {
				return {
					valid: false,
					error: 'No valid JWT validation method configured'
				};
			}

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
