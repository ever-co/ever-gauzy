/**
 * Authorization types for MCP Server
 *
 * These types are defined locally to avoid importing from @gauzy/auth,
 * which causes TypeScript compilation performance issues due to its complex
 * dependency chain in the monorepo.
 */

import { createHash } from 'node:crypto';
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
	/** RFC 7662 introspection at the authorization server (mcp-auth): how every bearer token is checked */
	introspection?: {
		endpoint: string;
		clientId: string;
		clientSecret: string;
	};
	/** How long an introspection answer is reused, in seconds (at most {@link MAX_TOKEN_CACHE_TTL_SECONDS}) */
	tokenCacheTtlSeconds?: number;
}

/** An introspection answer is reused for at most this long, so a revoked token stops working within a minute */
export const MAX_TOKEN_CACHE_TTL_SECONDS = 60;

/** The audience mcp-auth puts in its tokens when MCP_AUTH_JWT_AUDIENCE is not set */
const DEFAULT_TOKEN_AUDIENCE = 'gauzy-mcp-api';

/** How many introspection answers are kept at most */
const MAX_CACHED_TOKENS = 10000;

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
 * Load authorization configuration from environment.
 *
 * OAuth bearer token validation is ON unless `MCP_AUTH_ENABLED` is `false` (the variable the image, the k8s
 * manifests and the README always named; the server used to read `MCP_AUTHORIZATION_ENABLED` instead, off by
 * default). With it on, every HTTP and WebSocket caller presents a token that mcp-auth's introspection endpoint
 * answers as active, except a caller on this machine that presents none: the loopback desktop mode, where such a
 * caller acts as the GAUZY_AUTO_LOGIN account (see `isLocalCaller`).
 *
 * @param env The environment to read (the process environment by default).
 */
export function loadAuthorizationConfig(env: NodeJS.ProcessEnv = process.env): AuthorizationConfig {
	const enabled = !['false', '0', 'no', 'off'].includes((env.MCP_AUTH_ENABLED ?? '').trim().toLowerCase());
	const issuer = trimTrailingSlashes(env.MCP_AUTH_JWT_ISSUER || env.MCP_AUTH_ISSUER || '') || undefined;

	const endpoint = env.MCP_AUTH_INTROSPECTION_ENDPOINT || (issuer ? `${issuer}/oauth2/introspect` : undefined);
	const clientId = env.MCP_AUTH_INTROSPECTION_CLIENT_ID;
	const clientSecret = env.MCP_AUTH_INTROSPECTION_CLIENT_SECRET;

	const cacheTtl = Number.parseInt(env.MCP_AUTH_TOKEN_CACHE_TTL ?? '', 10);

	return {
		enabled,
		// `||`, not `??`: the deploy substitutes an unset secret as '', which must not mean "no scope required"
		requiredScopes: splitList(env.MCP_AUTH_REQUIRED_SCOPES || env.MCP_REQUIRED_SCOPES || 'mcp.read'),
		resourceUri: env.MCP_AUTH_RESOURCE_URI || env.MCP_RESOURCE_URI,
		authorizationServers:
			enabled && issuer
				? [
						{
							issuer,
							jwksUri: env.MCP_AUTH_JWT_JWKS_URI || env.MCP_AUTH_JWKS_URI,
							tokenEndpoint: env.MCP_AUTH_TOKEN_ENDPOINT,
							authorizationEndpoint: env.MCP_AUTH_AUTHORIZATION_ENDPOINT
						}
					]
				: [],
		tokenValidation: {
			audience: env.MCP_AUTH_JWT_AUDIENCE || DEFAULT_TOKEN_AUDIENCE,
			issuer
		},
		introspection: endpoint && clientId && clientSecret ? { endpoint, clientId, clientSecret } : undefined,
		tokenCacheTtlSeconds: Math.min(
			cacheTtl > 0 ? cacheTtl : MAX_TOKEN_CACHE_TTL_SECONDS,
			MAX_TOKEN_CACHE_TTL_SECONDS
		)
	};
}

/**
 * Says at start-up whether bearer tokens are checked, and what is missing for them to be.
 */
export function logAuthorizationSetup(
	config: AuthorizationConfig,
	log: { warn(message: string): void; error(message: string): void }
): void {
	if (!config.enabled) {
		log.warn(
			'⚠️  MCP_AUTH_ENABLED=false: OAuth bearer tokens are not checked. Callers authenticate with the login ' +
				'tool, and only a caller on this machine may use the GAUZY_AUTO_LOGIN account.'
		);
		return;
	}
	if (!config.introspection) {
		log.error(
			'Bearer tokens are required (MCP_AUTH_ENABLED), but token introspection is not configured: set ' +
				'MCP_AUTH_INTROSPECTION_CLIENT_ID, MCP_AUTH_INTROSPECTION_CLIENT_SECRET and MCP_AUTH_INTROSPECTION_ENDPOINT ' +
				'(or MCP_AUTH_JWT_ISSUER). Until then every caller not on this machine is refused.'
		);
	}
}

/** A list written with commas or spaces */
function splitList(value: string): string[] {
	return value.split(/[\s,]+/).filter(Boolean);
}

function trimTrailingSlashes(value: unknown): string {
	return String(value ?? '').replace(/\/+$/, '');
}

/**
 * OAuth validator for token validation.
 *
 * Every bearer token is checked by asking mcp-auth's introspection endpoint (RFC 7662) whether it is active, which
 * covers its signature, expiry, revocation and whether its user can still sign in. The answer must also name this
 * server's audience (and issuer, when one is configured), an expiry still ahead and a subject. Answers are reused
 * for at most a minute and never past the token's expiry; a failed introspection call is not reused, so the next
 * request asks again.
 */
export class OAuthValidator {
	private readonly cache = new Map<string, { result: TokenValidationResult; expiresAt: number }>();
	private readonly pending = new Map<string, Promise<TokenValidationResult>>();

	/**
	 * @param config The authorization configuration.
	 * @param fetchFn The HTTP client used to reach the introspection endpoint.
	 */
	constructor(
		private config: AuthorizationConfig,
		private readonly fetchFn: typeof fetch = fetch
	) {}

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

		const result = await this.introspect(token);
		if (result.valid && requiredScopes?.length) {
			const scopes = result.scopes ?? [];
			if (!requiredScopes.every((scope) => scopes.includes(scope))) {
				return { ...result, valid: false, error: 'insufficient_scope' };
			}
		}
		return result;
	}

	/**
	 * Asks the introspection endpoint about a token, reusing a recent answer.
	 */
	private async introspect(token: string): Promise<TokenValidationResult> {
		const introspection = this.config.introspection;
		if (!introspection) {
			return { valid: false, error: 'Token validation is not configured' };
		}

		// Keyed by a hash, so the cache holds no usable token
		const key = createHash('sha256').update(token).digest('hex');
		const cached = this.cache.get(key);
		if (cached && cached.expiresAt > Date.now()) {
			return cached.result;
		}
		this.cache.delete(key);

		// Concurrent requests with the same token share one call
		let pending = this.pending.get(key);
		if (!pending) {
			pending = this.ask(introspection, token, key).finally(() => this.pending.delete(key));
			this.pending.set(key, pending);
		}
		return pending;
	}

	private async ask(
		introspection: NonNullable<AuthorizationConfig['introspection']>,
		token: string,
		key: string
	): Promise<TokenValidationResult> {
		let answer: Record<string, unknown>;
		try {
			const credentials = Buffer.from(`${introspection.clientId}:${introspection.clientSecret}`).toString(
				'base64'
			);
			const response = await this.fetchFn(introspection.endpoint, {
				method: 'POST',
				headers: {
					Authorization: `Basic ${credentials}`,
					'Content-Type': 'application/x-www-form-urlencoded',
					Accept: 'application/json'
				},
				body: new URLSearchParams({ token, token_type_hint: 'access_token' }).toString(),
				signal: AbortSignal.timeout(5000)
			});
			if (!response.ok) {
				return { valid: false, error: `Token introspection failed (${response.status})` };
			}
			answer = ((await response.json()) as Record<string, unknown>) ?? {};
		} catch {
			return { valid: false, error: 'Token introspection failed' };
		}

		const now = Date.now();
		const result = this.judge(answer, now);

		// At most the cache lifetime, and never past the token's expiry
		const ttlMs =
			Math.min(this.config.tokenCacheTtlSeconds ?? MAX_TOKEN_CACHE_TTL_SECONDS, MAX_TOKEN_CACHE_TTL_SECONDS) *
			1000;
		const expiresAt = Math.min(
			now + ttlMs,
			result.valid ? (answer.exp as number) * 1000 : Number.POSITIVE_INFINITY
		);
		if (expiresAt > now) {
			this.remember(key, result, expiresAt);
		}
		return result;
	}

	/**
	 * Whether an introspection answer admits the token here: active, not expired, for this audience and issuer, and
	 * naming a subject.
	 */
	private judge(answer: Record<string, unknown>, now: number): TokenValidationResult {
		if (answer.active !== true) {
			return { valid: false, error: 'Token is not active' };
		}
		if (typeof answer.exp !== 'number' || answer.exp * 1000 <= now) {
			return { valid: false, error: 'Token expired' };
		}

		const audience = this.config.tokenValidation?.audience;
		const audiences = (Array.isArray(answer.aud) ? answer.aud : [answer.aud])
			.filter(Boolean)
			.map(trimTrailingSlashes);
		if (audience && !audiences.includes(trimTrailingSlashes(audience))) {
			return { valid: false, error: 'Token is not for this server (audience)' };
		}
		const issuers = ([] as string[]).concat(this.config.tokenValidation?.issuer ?? []).map(trimTrailingSlashes);
		if (issuers.length > 0 && !issuers.includes(trimTrailingSlashes(answer.iss))) {
			return { valid: false, error: 'Token is not from the configured issuer' };
		}
		if (typeof answer.sub !== 'string' || answer.sub === '') {
			return { valid: false, error: 'Token has no subject' };
		}

		return {
			valid: true,
			payload: answer,
			scopes: typeof answer.scope === 'string' ? splitList(answer.scope) : [],
			subject: answer.sub,
			clientId: typeof answer.client_id === 'string' ? answer.client_id : undefined
		};
	}

	private remember(key: string, result: TokenValidationResult, expiresAt: number): void {
		if (this.cache.size >= MAX_CACHED_TOKENS) {
			const now = Date.now();
			for (const [cachedKey, entry] of this.cache) {
				if (entry.expiresAt <= now) {
					this.cache.delete(cachedKey);
				}
			}
			// Still full: forget the oldest answers
			for (const cachedKey of this.cache.keys()) {
				if (this.cache.size < MAX_CACHED_TOKENS) {
					break;
				}
				this.cache.delete(cachedKey);
			}
		}
		this.cache.set(key, { result, expiresAt });
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
