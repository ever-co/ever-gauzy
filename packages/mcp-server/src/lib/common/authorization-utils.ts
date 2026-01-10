/**
 * Authorization Security Utilities
 *
 * This module provides security utilities for OAuth 2.0 authorization
 * including URL validation, token parsing, and security checks.
 */

import { URL } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';
import { SecurityLogger, securityLogger } from './security-logger';

/**
 * Validate canonical resource URI according to RFC 8707
 */
export function validateCanonicalResourceUri(uri: string): { valid: boolean; error?: string } {
	try {
		const url = new URL(uri);

		// Must use HTTPS (except for localhost development)
		if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) {
			return {
				valid: false,
				error: 'Resource URI must use HTTPS protocol (except for localhost)'
			};
		}

		// Must not have fragment
		if (url.hash) {
			return {
				valid: false,
				error: 'Resource URI must not contain fragment'
			};
		}

		// Must not have query parameters
		if (url.search) {
			return {
				valid: false,
				error: 'Resource URI must not contain query parameters'
			};
		}

		// Hostname must be lowercase
		if (url.hostname !== url.hostname.toLowerCase()) {
			return {
				valid: false,
				error: 'Resource URI hostname must be lowercase'
			};
		}

		return { valid: true };
	} catch (error) {
		return {
			valid: false,
			error: `Invalid URI format: ${error instanceof Error ? error.message : 'Unknown error'}`
		};
	}
}

/**
 * Normalize canonical resource URI
 */
export function normalizeCanonicalResourceUri(uri: string): string {
	try {
		const url = new URL(uri);

		// Ensure lowercase scheme and hostname
		url.protocol = url.protocol.toLowerCase();
		url.hostname = url.hostname.toLowerCase();

		// Remove trailing slash unless it's semantically significant
		if (url.pathname.endsWith('/') && url.pathname !== '/') {
			url.pathname = url.pathname.slice(0, -1);
		}

		// Remove default ports
		if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) {
			url.port = '';
		}

		return url.toString();
	} catch (error) {
		securityLogger.warn('Failed to normalize resource URI:', { uri, error });
		return uri;
	}
}

/**
 * Extract and validate Bearer token from Authorization header
 */
export function extractAndValidateBearerToken(authHeader: string): { valid: boolean; token?: string; error?: string } {
	if (!authHeader) {
		return {
			valid: false,
			error: 'Authorization header is required'
		};
	}

	// RFC 6750 Section 2.1: Authorization Request Header Field
	const matches = authHeader.match(/^Bearer\s+([A-Za-z0-9\-._~+/]+=*)$/);
	if (!matches) {
		return {
			valid: false,
			error: 'Invalid Authorization header format. Expected "Bearer <token>"'
		};
	}

	const token = matches[1];

	// Basic token validation
	if (token.length < 10) {
		return {
			valid: false,
			error: 'Token appears to be too short'
		};
	}

	if (token.length > 4096) {
		return {
			valid: false,
			error: 'Token appears to be too long'
		};
	}

	return {
		valid: true,
		token
	};
}

/**
 * Validate JWT structure (without signature verification)
 */
export function validateJWTStructure(token: string): { valid: boolean; header?: any; payload?: any; error?: string } {
	try {
		const parts = token.split('.');
		if (parts.length !== 3) {
			return {
				valid: false,
				error: 'Invalid JWT structure: must have exactly 3 parts'
			};
		}

		const [headerB64, payloadB64, signatureB64] = parts;

		// Validate base64url encoding
		if (!headerB64 || !payloadB64 || !signatureB64) {
			return {
				valid: false,
				error: 'Invalid JWT structure: empty parts'
			};
		}

		// Decode header and payload
		const header: { alg: string; typ: string; [key: string]: unknown } = JSON.parse(
			Buffer.from(headerB64, 'base64url').toString()
		);
		const payload: { [key: string]: unknown } = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());

		// Basic header validation
		if (!header.alg || !header.typ) {
			return {
				valid: false,
				error: 'Invalid JWT header: missing alg or typ'
			};
		}

		if (header.typ !== 'JWT') {
			return {
				valid: false,
				error: 'Invalid JWT header: typ must be JWT'
			};
		}

		return {
			valid: true,
			header,
			payload
		};
	} catch (error) {
		return {
			valid: false,
			error: `JWT parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
		};
	}
}

/**
 * Validate OAuth 2.0 scopes format
 */
export function validateOAuthScopes(scopes: string | string[]): {
	valid: boolean;
	normalizedScopes?: string[];
	error?: string;
} {
	try {
		let scopeArray: string[];

		if (typeof scopes === 'string') {
			// RFC 6749: scope values are case-sensitive and space-delimited
			scopeArray = scopes.split(' ').filter((s) => s.length > 0);
		} else if (Array.isArray(scopes)) {
			scopeArray = scopes;
		} else {
			return {
				valid: false,
				error: 'Scopes must be a string or array of strings'
			};
		}

		// Validate each scope
		for (const scope of scopeArray) {
			if (typeof scope !== 'string') {
				return {
					valid: false,
					error: 'All scopes must be strings'
				};
			}

			// RFC 6749: scope-token = 1*NQCHAR
			// NQCHAR = %x21 / %x23-5B / %x5D-7E (printable ASCII excluding space and quote)
			if (!/^[\x21\x23-\x5B\x5D-\x7E]+$/.test(scope)) {
				return {
					valid: false,
					error: `Invalid scope format: ${scope}`
				};
			}
		}

		return {
			valid: true,
			normalizedScopes: [...new Set(scopeArray)] // Remove duplicates
		};
	} catch (error) {
		return {
			valid: false,
			error: `Scope validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
		};
	}
}

/**
 * Check if required scopes are present in granted scopes
 */
export function checkScopeAccess(
	grantedScopes: string[],
	requiredScopes: string[]
): {
	hasAccess: boolean;
	missingScopes?: string[];
} {
	const missing = requiredScopes.filter((required) => !grantedScopes.includes(required));

	return {
		hasAccess: missing.length === 0,
		...(missing.length > 0 && { missingScopes: missing })
	};
}

/**
 * Validate authorization server URL
 */
export function validateAuthorizationServerUrl(url: string): { valid: boolean; error?: string } {
	try {
		const parsed = new URL(url);

		// Must use HTTPS in production
		if (parsed.protocol !== 'https:' && process.env.NODE_ENV === 'production') {
			return {
				valid: false,
				error: 'Authorization server URL must use HTTPS in production'
			};
		}

		// Must not have fragment
		if (parsed.hash) {
			return {
				valid: false,
				error: 'Authorization server URL must not contain fragment'
			};
		}

		// Disallow query parameters
		if (parsed.search) {
			return {
				valid: false,
				error: 'Authorization server URL must not contain query parameters'
			};
		}

		// Enforce lowercase hostname
		if (parsed.hostname !== parsed.hostname.toLowerCase()) {
			return {
				valid: false,
				error: 'Authorization server hostname must be lowercase'
			};
		}

		return { valid: true };
	} catch (error) {
		return {
			valid: false,
			error: `Invalid authorization server URL: ${error instanceof Error ? error.message : 'Unknown error'}`
		};
	}
}

/**
 * Generate secure random state parameter for OAuth 2.0 flows
 */
export function generateSecureState(): string {
	// Generate 32 bytes of random data and encode as base64url
	const randomBytesArray = randomBytes(32);
	return randomBytesArray.toString('base64url');
}

/**
 * Generate PKCE code verifier and challenge
 */
export function generatePKCEChallenge(): { codeVerifier: string; codeChallenge: string } {
	// Generate code verifier: 43-128 characters, base64url-encoded
	const randomBytesArray = randomBytes(32);
	const codeVerifier = randomBytesArray.toString('base64url');

	// Generate code challenge: SHA256 hash of verifier, base64url-encoded
	const hash = createHash('sha256');
	hash.update(codeVerifier);
	const codeChallenge = hash.digest().toString('base64url');

	return {
		codeVerifier,
		codeChallenge
	};
}

/**
 * Validate redirect URI according to OAuth 2.0 security best practices
 */
export function validateRedirectUri(uri: string, registeredUris: string[]): { valid: boolean; error?: string } {
	try {
		const url = new URL(uri);
		const normalize = (u: string) => {
			const parsed = new URL(u);
			parsed.protocol = parsed.protocol.toLowerCase();
			parsed.hostname = parsed.hostname.toLowerCase();
			if (
				(parsed.protocol === 'https:' && parsed.port === '443') ||
				(parsed.protocol === 'http:' && parsed.port === '80')
			) {
				parsed.port = '';
			}
			if (parsed.pathname.endsWith('/') && parsed.pathname !== '/') {
				parsed.pathname = parsed.pathname.slice(0, -1);
			}
			return parsed.toString();
		};

		// Must exactly match one of the registered URIs (after normalization)
		const normalized = normalize(uri);
		const normalizedRegistered = registeredUris.map(normalize);
		if (!normalizedRegistered.includes(normalized)) {
			return {
				valid: false,
				error: 'Redirect URI does not match any registered URI'
			};
		}

		// Localhost is allowed for development
		if (['localhost', '127.0.0.1'].includes(url.hostname)) {
			return { valid: true };
		}

		// Must use HTTPS for non-localhost
		if (url.protocol !== 'https:') {
			return {
				valid: false,
				error: 'Redirect URI must use HTTPS (except for localhost)'
			};
		}

		return { valid: true };
	} catch (error) {
		return {
			valid: false,
			error: `Invalid redirect URI: ${error instanceof Error ? error.message : 'Unknown error'}`
		};
	}
}

/**
 * Rate limiting for authorization endpoints
 */
export class AuthorizationRateLimiter {
	private attempts = new Map<string, { count: number; resetTime: number }>();
	private readonly maxAttempts: number;
	private readonly windowMs: number;

	constructor(maxAttempts = 10, windowMs = 15 * 60 * 1000) {
		// 10 attempts per 15 minutes
		this.maxAttempts = maxAttempts;
		this.windowMs = windowMs;

		// Clean up expired entries every hour
		const t = setInterval(() => this.cleanup(), 60 * 60 * 1000);
		(t as any).unref?.();
	}

	isAllowed(identifier: string): boolean {
		const now = Date.now();
		const entry = this.attempts.get(identifier);

		if (!entry) {
			this.attempts.set(identifier, { count: 1, resetTime: now + this.windowMs });
			return true;
		}

		if (now > entry.resetTime) {
			// Reset window
			this.attempts.set(identifier, { count: 1, resetTime: now + this.windowMs });
			return true;
		}

		if (entry.count >= this.maxAttempts) {
			return false;
		}

		entry.count++;
		return true;
	}

	private cleanup(): void {
		const now = Date.now();
		for (const [key, entry] of this.attempts.entries()) {
			if (now > entry.resetTime) {
				this.attempts.delete(key);
			}
		}
	}
}
