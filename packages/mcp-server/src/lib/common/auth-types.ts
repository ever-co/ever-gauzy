/**
 * Authorization types for MCP Server
 *
 * These types are defined locally to avoid importing from @gauzy/auth,
 * which causes TypeScript compilation performance issues due to its complex
 * dependency chain in the monorepo.
 */

import { Request, Response } from 'express';

/**
 * Authorization server configuration
 */
export interface AuthorizationServerConfig {
	issuer: string;
	jwksUri?: string;
	tokenEndpoint?: string;
	authorizationEndpoint?: string;
}

/**
 * Authorization configuration
 */
export interface AuthorizationConfig {
	enabled: boolean;
	requiredScopes: string[];
	resourceUri?: string;
	authorizationServers: AuthorizationServerConfig[];
	tokenValidation?: {
		audience?: string;
		issuer?: string | string[];
		clockTolerance?: number;
	};
}

/**
 * OAuth 2.0 Protected Resource Metadata (RFC 9728)
 */
export interface ProtectedResourceMetadata {
	resource: string;
	authorizationServers: string[];
	scopesRequired?: string[];
	bearerMethodsSupported?: string[];
	policyUri?: string;
}

/**
 * OAuth authorization error
 */
export interface OAuthAuthorizationError {
	error: string;
	errorDescription?: string;
	errorUri?: string;
	scope?: string;
}

/**
 * Token validation result
 */
export interface TokenValidationResult {
	valid: boolean;
	error?: string;
	payload?: unknown;
	scopes?: string[];
	subject?: string;
	clientId?: string;
}

/**
 * Load authorization configuration from environment
 */
export function loadAuthorizationConfig(): AuthorizationConfig {
	const enabled = process.env.MCP_AUTHORIZATION_ENABLED === 'true';

	return {
		enabled,
		requiredScopes: (process.env.MCP_REQUIRED_SCOPES || 'mcp:read mcp:write').split(' ').filter(Boolean),
		resourceUri: process.env.MCP_RESOURCE_URI,
		authorizationServers: enabled
			? [
					{
						issuer: process.env.MCP_AUTH_ISSUER || 'https://auth.example.com',
						jwksUri: process.env.MCP_AUTH_JWKS_URI,
						tokenEndpoint: process.env.MCP_AUTH_TOKEN_ENDPOINT,
						authorizationEndpoint: process.env.MCP_AUTH_AUTHORIZATION_ENDPOINT
					}
			  ]
			: []
	};
}

/**
 * OAuth validator for token validation
 */
export class OAuthValidator {
	constructor(private config: AuthorizationConfig) {}

	/**
	 * Extract bearer token from request
	 */
	extractBearerToken(req: Request): string | null {
		const authHeader = req.headers.authorization;
		if (!authHeader || !authHeader.startsWith('Bearer ')) {
			return null;
		}
		return authHeader.substring(7);
	}

	/**
	 * Validate an OAuth token
	 */
	async validateToken(token: string, requiredScopes?: string[]): Promise<TokenValidationResult> {
		if (!this.config.enabled) {
			return { valid: true };
		}

		// TODO: Implement actual JWT validation when authorization is enabled
		// For now, return invalid if authorization is enabled but no implementation
		return {
			valid: false,
			error: 'Token validation not implemented'
		};
	}

	/**
	 * Create authorization error object
	 */
	static createAuthorizationError(
		error: string,
		errorDescription?: string,
		scope?: string
	): OAuthAuthorizationError {
		return {
			error,
			errorDescription,
			scope
		};
	}

	/**
	 * Format WWW-Authenticate header
	 */
	static formatWWWAuthenticateHeader(resourceUri: string, error?: OAuthAuthorizationError): string {
		let header = 'Bearer';

		if (resourceUri) {
			header += ` resource="${resourceUri}"`;
		}

		if (error) {
			if (error.error) {
				header += ` error="${error.error}"`;
			}
			if (error.errorDescription) {
				header += ` error_description="${error.errorDescription}"`;
			}
			if (error.scope) {
				header += ` scope="${error.scope}"`;
			}
		}

		return header;
	}
}

/**
 * Response builder utilities
 */
export class ResponseBuilder {
	/**
	 * Set security headers on response
	 */
	static setSecurityHeaders(res: Response): void {
		// Content-Type options
		res.setHeader('X-Content-Type-Options', 'nosniff');

		// Frame options
		res.setHeader('X-Frame-Options', 'DENY');

		// XSS protection
		res.setHeader('X-XSS-Protection', '1; mode=block');

		// Referrer policy
		res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

		// Content Security Policy
		res.setHeader(
			'Content-Security-Policy',
			"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
		);

		// Strict Transport Security (for HTTPS)
		res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

		// Cache control for API responses
		res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
		res.setHeader('Pragma', 'no-cache');
		res.setHeader('Expires', '0');
	}

	/**
	 * Build success response
	 */
	static success<T>(data: T, message?: string): { success: true; data: T; message?: string } {
		return { success: true, data, message };
	}

	/**
	 * Build error response
	 */
	static error(message: string, code?: string): { success: false; error: string; code?: string } {
		return { success: false, error: message, code };
	}
}
