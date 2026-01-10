/**
 * Authorization Middleware for MCP Server
 *
 * This middleware handles OAuth 2.0 authorization for HTTP-based MCP transport
 * following RFC 6749, RFC 9728, and MCP authorization specification.
 */

import { Request, Response, NextFunction } from 'express';
import { AuthorizationConfig, ProtectedResourceMetadata, OAuthValidator } from './auth-types';
import { SecurityLogger } from './security-logger';

export interface AuthorizedRequest extends Request {
	/** OAuth token validation result */
	tokenInfo?: {
		valid: boolean;
		payload?: any;
		scopes?: string[];
		subject?: string;
		clientId?: string;
	};
}

export class AuthorizationMiddleware {
	private validator: OAuthValidator;
	private securityLogger: SecurityLogger;

	constructor(private config: AuthorizationConfig) {
		this.validator = new OAuthValidator(config);
		this.securityLogger = new SecurityLogger();
	}

	/**
	 * Create middleware function for protecting MCP endpoints
	 */
	createAuthorizationMiddleware(
		options: {
			requiredScopes?: string[];
			optional?: boolean; // Allow requests without tokens if true
		} = {}
	) {
		return async (req: AuthorizedRequest, res: Response, next: NextFunction) => {
			try {
				// Skip authorization if disabled
				if (!this.config.enabled) {
					this.securityLogger.debug('Authorization disabled, skipping token validation');
					return next();
				}

				// Determine required scopes early so we can include them in 401 responses
				const requiredScopes = options.requiredScopes || this.config.requiredScopes;
				const token = this.validator.extractBearerToken(req);

				// Handle missing token
				if (!token) {
					if (options.optional) {
						this.securityLogger.debug('No token provided, but authorization is optional');
						return next();
					}

					this.securityLogger.warn('Authorization required but no token provided', {
						path: req.path,
						method: req.method,
						ip: req.ip
					});

					return this.sendUnauthorizedResponse(res, 'Authorization required', requiredScopes);
				}

				// Validate token
				const validationResult = await this.validator.validateToken(token, requiredScopes);

				if (!validationResult.valid) {
					this.securityLogger.warn('Token validation failed', {
						path: req.path,
						method: req.method,
						ip: req.ip,
						error: validationResult.error
					});

					// Map scope failures to 403 as per RFC 6750
					if (/^insufficient[_\s]?scope$/i.test(validationResult.error || '') && requiredScopes?.length) {
						return this.sendForbiddenResponse(res, requiredScopes);
					}
					return this.sendUnauthorizedResponse(res, validationResult.error, requiredScopes);
				}

				// Attach token info to request
				req.tokenInfo = {
					valid: true,
					payload: validationResult.payload,
					scopes: validationResult.scopes,
					subject: validationResult.subject,
					clientId: validationResult.clientId
				};

				this.securityLogger.debug('Token validation successful', {
					path: req.path,
					method: req.method,
					subject: validationResult.subject,
					clientId: validationResult.clientId,
					scopes: validationResult.scopes
				});

				next();
			} catch (error: unknown) {
				this.securityLogger.error('Authorization middleware error:', error as Error);
				return this.sendServerError(res, 'Authorization processing failed');
			}
		};
	}

	/**
	 * Middleware for serving OAuth 2.0 Protected Resource Metadata (RFC 9728)
	 */
	createProtectedResourceMetadataMiddleware() {
		return (req: Request, res: Response) => {
			try {
				const metadata = this.generateProtectedResourceMetadata(req);

				this.securityLogger.debug('Serving protected resource metadata', {
					resource: metadata.resource,
					authorizationServers: metadata.authorizationServers
				});

				res.setHeader('Content-Type', 'application/json');
				res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
				res.json(metadata);
			} catch (error: any) {
				this.securityLogger.error('Error serving protected resource metadata:', error);
				res.status(500).json({
					error: 'internal_server_error',
					error_description: 'Failed to generate resource metadata'
				});
			}
		};
	}

	/**
	 * Generate Protected Resource Metadata according to RFC 9728
	 */
	private generateProtectedResourceMetadata(req: Request): ProtectedResourceMetadata {
		// Determine the canonical resource URI
		const resourceUri = this.config.resourceUri || this.buildCanonicalResourceUri(req);

		// Extract authorization server issuers
		const authorizationServers = this.config.authorizationServers.map((server) => server.issuer);

		const metadata: ProtectedResourceMetadata = {
			resource: resourceUri,
			authorizationServers,
			scopesRequired: this.config.requiredScopes,
			bearerMethodsSupported: ['header'] // RFC 6750 Section 2.1
		};

		// Add optional metadata
		if (process.env.MCP_POLICY_URI) {
			metadata.policyUri = process.env.MCP_POLICY_URI;
		}

		return metadata;
	}

	/**
	 * Build canonical resource URI from request
	 */
	private buildCanonicalResourceUri(req: Request): string {
		const xfProto = req.headers['x-forwarded-proto'] as string | undefined;
		const forwardedProto = xfProto && xfProto.split(',')[0].trim();
		const protocol = req.secure || forwardedProto === 'https' ? 'https' : 'http';
		const xfHost = req.headers['x-forwarded-host'] as string | undefined;
		const host = (xfHost && xfHost.split(',')[0].trim()) || req.get('host') || 'localhost';

		// Build base URL
		let resourceUri = `${protocol}://${host.toLowerCase()}`;

		// Add path if it's not just the root
		if (req.baseUrl && req.baseUrl !== '/') {
			resourceUri += req.baseUrl;
		}

		return resourceUri;
	}

	/**
	 * Send 401 Unauthorized response with WWW-Authenticate header
	 */
	private sendUnauthorizedResponse(res: Response, errorDescription?: string, requiredScopes?: string[]): void {
		const resourceMetadataUrl = `${this.getBaseUrl(res.req as Request)}/.well-known/oauth-protected-resource`;

		const authError = OAuthValidator.createAuthorizationError(
			'invalid_token',
			errorDescription,
			(requiredScopes || this.config.requiredScopes)?.join(' ')
		);

		const wwwAuthenticateHeader = OAuthValidator.formatWWWAuthenticateHeader(resourceMetadataUrl, authError);

		res.setHeader('WWW-Authenticate', wwwAuthenticateHeader);
		res.setHeader('Vary', 'Authorization');
		res.setHeader('Cache-Control', 'no-store');
		res.status(401).json({
			error: authError.error,
			error_description: authError.errorDescription,
			error_uri: authError.errorUri,
			scope: authError.scope
		});
	}

	/**
	 * Send 403 Forbidden response for insufficient scopes
	 */
	private sendForbiddenResponse(res: Response, requiredScopes: string[]): void {
		const authError = OAuthValidator.createAuthorizationError(
			'insufficient_scope',
			'The request requires higher privileges than provided by the access token',
			requiredScopes.join(' ')
		);

		// Include WWW-Authenticate per RFC 6750 and vary on Authorization
		const resourceMetadataUrl = `${this.getBaseUrl(res.req as Request)}/.well-known/oauth-protected-resource`;
		const wwwAuthenticateHeader = OAuthValidator.formatWWWAuthenticateHeader(resourceMetadataUrl, authError);
		res.setHeader('WWW-Authenticate', wwwAuthenticateHeader);
		res.setHeader('Vary', 'Authorization');
		res.setHeader('Cache-Control', 'no-store');
		res.status(403).json({
			error: authError.error,
			error_description: authError.errorDescription,
			scope: authError.scope
		});
	}

	/**
	 * Send 500 Internal Server Error response
	 */
	private sendServerError(res: Response, message: string): void {
		res.setHeader('Cache-Control', 'no-store');
		res.status(500).json({
			error: 'server_error',
			error_description: message
		});
	}

	/**
	 * Get base URL from request
	 */
	private getBaseUrl(req: Request): string {
		const xfProto = req.headers['x-forwarded-proto'] as string | undefined;
		const forwardedProto = xfProto && xfProto.split(',')[0].trim();
		const protocol = req.secure || forwardedProto === 'https' ? 'https' : 'http';
		const xfHost = req.headers['x-forwarded-host'] as string | undefined;
		const host = (xfHost && xfHost.split(',')[0].trim()) || req.get('host') || 'localhost';
		return `${protocol}://${host}`;
	}

	/**
	 * Check if request has required scopes
	 */
	hasRequiredScopes(req: AuthorizedRequest, requiredScopes: string[]): boolean {
		if (!this.config.enabled) {
			return true;
		}

		if (!req.tokenInfo?.valid || !req.tokenInfo.scopes) {
			return false;
		}

		return requiredScopes.every((scope) => req.tokenInfo!.scopes!.includes(scope));
	}

	/**
	 * Get user information from token
	 */
	getUserInfo(req: AuthorizedRequest): { subject?: string; clientId?: string; scopes?: string[] } | null {
		if (!req.tokenInfo?.valid) {
			return null;
		}

		return {
			subject: req.tokenInfo.subject,
			clientId: req.tokenInfo.clientId,
			scopes: req.tokenInfo.scopes
		};
	}
}
