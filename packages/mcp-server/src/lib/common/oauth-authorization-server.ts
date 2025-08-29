/**
 * OAuth 2.0 Authorization Server
 *
 * Complete OAuth 2.0 authorization server implementation for MCP
 * Supports authorization code flow with PKCE, client credentials, and refresh tokens
 */

import express, { Request, Response, NextFunction } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import { SecurityLogger } from './security-logger';
import escapeHtml from 'escape-html';
import { doubleCsrf } from 'csrf-csrf';
import { oAuth2ClientManager, OAuth2Client } from './oauth-client-manager';
import { oAuth2AuthorizationCodeManager } from './oauth-authorization-code-manager';
import { OAuth2TokenManager } from './oauth-token-manager';
import { OAuthValidator } from './oauth-validator';
import { AuthorizationConfig } from './authorization-config';

export interface OAuth2ServerConfig {
	issuer: string;
	baseUrl: string;
	audience: string;
	enableClientRegistration: boolean;
	authorizationEndpoint: string;
	tokenEndpoint: string;
	jwksEndpoint: string;
	registrationEndpoint?: string;
	introspectionEndpoint?: string;
	userInfoEndpoint?: string;
	loginEndpoint?: string;
	sessionSecret: string;
	redisUrl?: string;
}

export interface UserInfo {
	userId: string;
	email: string;
	name?: string;
	organizationId?: string;
	tenantId?: string;
	roles?: string[];
	emailVerified?: boolean;
	picture?: string;
}

export interface AuthenticatedUser extends UserInfo {
	accessToken?: string;
	refreshToken?: string;
}

export interface LoginCredentials {
	email: string;
	password: string;
}

export interface IntrospectionRequest {
	token: string;
	token_type_hint?: 'access_token' | 'refresh_token';
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

export interface AuthorizeRequest {
	response_type: string;
	client_id: string;
	redirect_uri: string;
	scope?: string;
	state?: string;
	code_challenge?: string;
	code_challenge_method?: 'S256' | 'plain';
}

export interface TokenRequest {
	grant_type: string;
	code?: string;
	redirect_uri?: string;
	client_id: string;
	client_secret?: string;
	code_verifier?: string;
	refresh_token?: string;
	scope?: string;
}

export class OAuth2AuthorizationServer {
	private app: express.Application;
	private tokenManager: OAuth2TokenManager;
	private oAuthValidator: OAuthValidator;
	private securityLogger: SecurityLogger;
	private userInfoProvider?: (userId: string) => Promise<UserInfo | null>;
	private authenticateUser?: (credentials: LoginCredentials) => Promise<AuthenticatedUser | null>;
	private users: Map<string, AuthenticatedUser> = new Map(); // In-memory user store for demo

	// Add CSRF protection properties
	private csrfProtection: any;
	private generateToken: any;

	constructor(private config: OAuth2ServerConfig) {
		this.securityLogger = new SecurityLogger();
		this.tokenManager = new OAuth2TokenManager(config.issuer, config.audience);

		this.initializeCSRFProtection();

		// Create basic authorization config for the validator
		const authConfig: AuthorizationConfig = {
			enabled: true,
			resourceUri: config.audience,
			authorizationServers: [{
				issuer: config.issuer,
				authorizationEndpoint: config.authorizationEndpoint,
				tokenEndpoint: config.tokenEndpoint,
				grantTypesSupported: ['authorization_code', 'refresh_token', 'client_credentials'],
				responseTypesSupported: ['code']
			}],
			jwt: {
				audience: config.audience,
				issuer: config.issuer,
				algorithms: ['RS256'],
				jwksUri: `${config.baseUrl}${config.jwksEndpoint}`
			}
		};

		// Add the public key to the auth config for JWT validation
		authConfig.jwt!.publicKey = this.tokenManager.getPublicKeyPEM();

		this.oAuthValidator = new OAuthValidator(authConfig);
		this.app = express();
		this.initializeDemoUsers();
		this.setupMiddleware();
		this.setupRoutes();
		this.setupErrorHandling();
	}

	private initializeCSRFProtection() {
		const isHttps = this.config.baseUrl.startsWith('https');

		const {
			generateCsrfToken,
			doubleCsrfProtection,
		} = doubleCsrf({
			getSecret: () => this.config.sessionSecret,
			getSessionIdentifier: (req) => {
				// For local development, use a simple consistent identifier
				if (!isHttps) {
					return `local-session-${req.ip || '127.0.0.1'}`;
				}
				// Use session ID if available, otherwise fall back to IP + User-Agent
				const session = req.session as any;
				if (session?.id) {
					return session.id;
				}
				const ip = req.ip || req.connection.remoteAddress || 'unknown-ip';
				const userAgent = req.get('User-Agent') || 'unknown-agent';
				return `${ip}-${userAgent}`;
			},
			cookieName: isHttps ? '__Host-mcp.x-csrf-token' : 'mcp-csrf-token',
			cookieOptions: {
				httpOnly: true,
				sameSite: isHttps ? 'strict' : 'lax',
				secure: isHttps,
				path: '/',
			},
			size: 64,
			ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
			getCsrfTokenFromRequest: (req) => {
				return req.body._csrf || req.headers['x-csrf-token'];
			},
		});

		this.csrfProtection = doubleCsrfProtection;
		this.generateToken = generateCsrfToken;
	}

	/**
	 * Set user info provider for user consent and token claims
	 */
	setUserInfoProvider(provider: (userId: string) => Promise<UserInfo | null>) {
		this.userInfoProvider = provider;
	}

	/**
	 * Set user authentication provider
	 */
	setUserAuthenticator(authenticator: (credentials: LoginCredentials) => Promise<AuthenticatedUser | null>) {
		this.authenticateUser = authenticator;
	}

	/**
	 * Initialize demo users for local environment (development/testing) only.
	 */
	private initializeDemoUsers() {
		const demoUsers: AuthenticatedUser[] = [
			{
				userId: '19040f7c-064f-4ed6-824d-d692003be6b1',
				email: 'employee@ever.co',
				name: 'Default Employee',
				organizationId: 'f180cd17-4cfd-4bab-bf14-c3ea94747930',
				tenantId: 'ccd9e6d7-47c5-4166-8161-de1134c82629',
				roles: ['employee'],
				emailVerified: true
			},
			{
				userId: 'admin-user-456',
				email: 'admin@ever.co',
				name: 'Default Admin',
				organizationId: 'org-123',
				tenantId: 'tenant-123',
				roles: ['admin'],
				emailVerified: true
			}
		];

		demoUsers.forEach(user => {
			this.users.set(user.email, user);
		});
	}

	/**
	 * Setup middleware
	 */
	private setupMiddleware() {
		// Cookie parser
		this.app.use(cookieParser());

		// Session management
		const sessionConfig: session.SessionOptions = {
			secret: this.config.sessionSecret,
			name: 'mcp-oauth-session',
			resave: false,
			saveUninitialized: false,
			cookie: {
				secure: this.config.baseUrl.startsWith('https'),
				httpOnly: true,
				maxAge: 1000 * 60 * 60 * 24, // 24 hours
				sameSite: 'lax'
			},
			rolling: true
		};

		// Add Redis store if URL is provided (prioritize REDIS_URL env var for production durability)
		const redisUrl = process.env.REDIS_URL || this.config.redisUrl;
		if (redisUrl) {
			try {
				const RedisStore = require('connect-redis').default;
				const Redis = require('ioredis');
				const redisClient = new Redis(redisUrl, {
					// Production-ready Redis configuration
					retryDelayOnFailover: 100,
					enableReadyCheck: false,
					maxRetriesPerRequest: 3,
					lazyConnect: true,
					// Log connection events for better monitoring
					connectionName: 'mcp-oauth-session-store'
				});

				// Handle Redis connection events
				redisClient.on('connect', () => {
					this.securityLogger.info('Redis session store connected');
				});
				redisClient.on('error', (error) => {
					this.securityLogger.error('Redis session store error:', error);
				});
				redisClient.on('ready', () => {
					this.securityLogger.info('Redis session store ready');
				});

				sessionConfig.store = new RedisStore({
					client: redisClient,
					prefix: 'mcp-oauth-sess:',
					ttl: 60 * 60 * 24 // 24 hours TTL
				});
				this.securityLogger.info(`Redis session store configured using ${process.env.REDIS_URL ? 'REDIS_URL' : 'config.redisUrl'}`);
			} catch (error: any) {
				this.securityLogger.error('Failed to configure Redis store, falling back to memory store:', error);
				if (process.env.NODE_ENV === 'production') {
					this.securityLogger.error('CRITICAL: Production deployment requires persistent session storage!');
				}
			}
		}

		if (!sessionConfig.store && process.env.NODE_ENV === 'production') {
			this.securityLogger.error('CRITICAL: Using in-memory session store in production. Configure REDIS_URL environment variable for session durability and scalability!');
		} else if (!sessionConfig.store) {
			this.securityLogger.info('Using in-memory session store for development');
		}
		this.app.use(session(sessionConfig));

		// Security headers
		this.app.use(helmet({
			contentSecurityPolicy: {
				directives: {
					defaultSrc: ["'self'"],
					styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
					fontSrc: ["'self'", "https://fonts.gstatic.com"],
					imgSrc: ["'self'", "data:", "https:"],
					scriptSrc: process.env.NODE_ENV !== 'production'
						? ["'self'", "'unsafe-inline'"]
						: ["'self'"],
					objectSrc: ["'none'"],
					baseUri: ["'self'"],
					formAction: ["'self'"],
					frameAncestors: ["'none'"]
				}
			}
		}));

		// Rate limiting
		const authRateLimit = rateLimit({
			windowMs: 15 * 60 * 1000, // 15 minutes
			max: 100, // requests per windowMs
			message: {
				error: 'too_many_requests',
				error_description: 'Rate limit exceeded'
			},
			standardHeaders: true,
			legacyHeaders: false
		});

		this.app.use(authRateLimit);

		// Body parsing
		this.app.use(express.json({ limit: '10mb' }));
		this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
	}

	/**
	 * Setup OAuth 2.0 endpoints
	 */
	private setupRoutes() {
		// Authorization Server Metadata (RFC 8414)
		this.app.get('/.well-known/oauth-authorization-server', (req, res) => {
			this.handleAuthorizationServerMetadata(req, res);
		});

		// JWKS endpoint (RFC 7517)
		this.app.get(this.config.jwksEndpoint, (req, res) => {
			this.handleJWKS(req, res);
		});

		// Login endpoints with CSRF protection
		if (this.config.loginEndpoint) {
			// GET request doesn't need CSRF protection - just generate token
			this.app.get(this.config.loginEndpoint, (req, res) => {
				this.handleLoginPage(req, res);
			});
			// POST request needs CSRF protection
			this.app.post(this.config.loginEndpoint, this.csrfProtection, (req, res) => {
				this.handleLogin(req, res);
			});
		}

		 // Authorization endpoint (GET doesn't need CSRF, POST does)
		this.app.get(this.config.authorizationEndpoint, (req, res) => {
			this.handleAuthorize(req, res);
		});

		// Authorization consent (POST) with CSRF protection
		this.app.post(this.config.authorizationEndpoint, this.csrfProtection, (req, res) => {
			this.handleAuthorizationConsent(req, res);
		});

		// Token endpoint (RFC 6749 Section 3.2)
		this.app.post(this.config.tokenEndpoint, (req, res) => {
			this.handleToken(req, res);
		});

		// Client registration endpoint (RFC 7591)
		if (this.config.enableClientRegistration && this.config.registrationEndpoint) {
			this.app.post(this.config.registrationEndpoint, (req, res) => {
				this.handleClientRegistration(req, res);
			});
		}

		// Token introspection endpoint (RFC 7662)
		if (this.config.introspectionEndpoint) {
			this.app.post(this.config.introspectionEndpoint, (req, res) => {
				this.handleTokenIntrospection(req, res);
			});
		}

		// User info endpoint (OpenID Connect)
		if (this.config.userInfoEndpoint) {
			this.app.get(this.config.userInfoEndpoint, (req, res) => {
				this.handleUserInfo(req, res);
			});
		}

		// Simple callback endpoint for testing
		this.app.get('/callback', (req, res) => {
			this.handleTestCallback(req, res);
		});
	}

	/**
	 * Handle test callback endpoint (for development/testing)
	 */
	private handleTestCallback(req: Request, res: Response) {
		const { code, state, error, error_description } = req.query;

		if (error) {
			res.status(400).send(`
				<!DOCTYPE html>
				<html>
				<head>
					<title>OAuth Callback - Error</title>
					<meta charset="utf-8">
					<meta name="viewport" content="width=device-width, initial-scale=1">
					<style>
						body { font-family: Arial, sans-serif; max-width: 600px; margin: 100px auto; padding: 20px; background: #f5f5f5; }
						.card { border: 1px solid #dc3545; border-radius: 8px; padding: 30px; background: #fff; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
						.error { color: #dc3545; }
						.code { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; padding: 10px; font-family: monospace; word-break: break-all; }
					</style>
				</head>
				<body>
					<div class="card">
						<h1 class="error">❌ OAuth Authorization Failed</h1>
						<p><strong>Error:</strong> ${escapeHtml(error as string)}</p>
						<p><strong>Description:</strong> ${escapeHtml(error_description as string || 'No description provided')}</p>
						${state ? `<p><strong>State:</strong> ${escapeHtml(state as string)}</p>` : ''}
					</div>
				</body>
				</html>
			`);
			return;
		}

		if (code) {
			res.send(`
				<!DOCTYPE html>
				<html>
				<head>
					<title>OAuth Callback - Success</title>
					<meta charset="utf-8">
					<meta name="viewport" content="width=device-width, initial-scale=1">
					<style>
						body { font-family: Arial, sans-serif; max-width: 600px; margin: 100px auto; padding: 20px; background: #f5f5f5; }
						.card { border: 1px solid #28a745; border-radius: 8px; padding: 30px; background: #fff; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
						.success { color: #28a745; }
						.code { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; padding: 10px; font-family: monospace; word-break: break-all; margin: 10px 0; }
						.copy-btn { background: #007bff; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; margin-left: 10px; }
						.copy-btn:hover { background: #0056b3; }
						.instructions { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 15px; margin: 20px 0; }
					</style>
				</head>
				<body>
					<div class="card">
						<h1 class="success">✅ OAuth Authorization Successful!</h1>
						<p>Authorization code received successfully. Use this code in your token exchange request:</p>

						<div class="instructions">
							<strong>📋 Next Steps:</strong>
							<ol>
								<li>Copy the authorization code below</li>
								<li>Use it in Postman for the token exchange (Step 5)</li>
								<li>You have ~10 minutes before this code expires</li>
							</ol>
						</div>

						<p><strong>Authorization Code:</strong></p>
						<div class="code" id="authCode">${escapeHtml(code as string)}</div>
						<button class="copy-btn" onclick="copyToClipboard()">📋 Copy Code</button>

						${state ? `
							<p style="margin-top: 20px;"><strong>State:</strong></p>
							<div class="code">${escapeHtml(state as string)}</div>
						` : ''}

						<div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666;">
							<strong>🔧 Token Exchange Request:</strong><br>
							Use this code in your Postman POST request to:<br>
							<code>http://localhost:3001/oauth2/token</code>
						</div>
					</div>

					<script>
						function copyToClipboard() {
							const codeElement = document.getElementById('authCode');
							const code = codeElement.textContent;
							navigator.clipboard.writeText(code).then(() => {
								alert('Authorization code copied to clipboard!');
							});
						}
					</script>
				</body>
				</html>
			`);
		} else {
			res.status(400).send(`
				<!DOCTYPE html>
				<html>
				<head><title>OAuth Callback - Invalid</title></head>
				<body>
					<h1>❌ Invalid Callback</h1>
					<p>No authorization code or error received.</p>
				</body>
				</html>
			`);
		}
	}

	/**
	 * Handle authorization server metadata
	 */
	private handleAuthorizationServerMetadata(req: Request, res: Response) {
		const metadata = {
			issuer: this.config.issuer,
			authorization_endpoint: `${this.config.baseUrl}${this.config.authorizationEndpoint}`,
			token_endpoint: `${this.config.baseUrl}${this.config.tokenEndpoint}`,
			jwks_uri: `${this.config.baseUrl}${this.config.jwksEndpoint}`,
			registration_endpoint: this.config.registrationEndpoint ?
				`${this.config.baseUrl}${this.config.registrationEndpoint}` : undefined,
			introspection_endpoint: this.config.introspectionEndpoint ?
				`${this.config.baseUrl}${this.config.introspectionEndpoint}` : undefined,
			userinfo_endpoint: this.config.userInfoEndpoint ?
				`${this.config.baseUrl}${this.config.userInfoEndpoint}` : undefined,
			scopes_supported: ['openid', 'profile', 'email', 'roles', 'mcp.read', 'mcp.write', 'mcp.admin'],
			response_types_supported: ['code'],
			grant_types_supported: ['authorization_code', 'refresh_token', 'client_credentials'],
			code_challenge_methods_supported: ['S256', 'plain'],
			token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
			revocation_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic']
		};

		res.json(metadata);
	}

	/**
	 * Handle JWKS endpoint
	 */
	private handleJWKS(req: Request, res: Response) {
		try {
			const jwks = this.tokenManager.getJWKS();
			res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
			res.json(jwks);
		} catch (error: any) {
			this.securityLogger.error('JWKS endpoint error:', error);
			res.status(500).json({
				error: 'server_error',
				error_description: 'Failed to retrieve key set'
			});
			return;
		}
	}

	/**
	 * Handle login page with CSRF token
	 */
	private handleLoginPage(req: Request, res: Response) {
		const error = req.query.error as string;
		const rawReturnUrl = (req.query.return_url as string) || this.config.authorizationEndpoint;
		const safeReturnUrl = this.normalizeReturnUrl(rawReturnUrl);

		// Generate CSRF token for the form
		const csrfToken = this.generateToken(req, res);
		const sessionId = !this.config.baseUrl.startsWith('https') ? `local-session-${req.ip || '127.0.0.1'}` : 'session-based';
		this.securityLogger.debug(`Generated CSRF token for login form - Token: ${csrfToken?.substring(0, 10)}..., Session ID: ${sessionId}`);

		res.send(this.generateLoginForm(error, safeReturnUrl, csrfToken));
	}

	// Allowlist of permitted relative return URLs for redirection (add your app's expected endpoints here)
	private static readonly ALLOWED_RETURN_PATHS = [
		'/oauth2/authorize',  // OAuth authorization endpoint
		'/oauth2/callback',   // OAuth callback endpoint
		'/callback',          // Test callback endpoint
		'/dashboard',
		'/profile',
		// Add other safe endpoints as appropriate
	];

	private normalizeReturnUrl(input?: string): string {
		if (!input) return this.config.authorizationEndpoint;
		try {
			// Allow only relative paths, and only if in allowlist, always strip query/fragment
			if (input.startsWith('/')) {
				const [path] = input.split('?'); // ignore query string for allowlist check
				if (OAuth2AuthorizationServer.ALLOWED_RETURN_PATHS.includes(path)) {
					return path; // Only return the clean, allowlisted path
				}
				return this.config.authorizationEndpoint;
			}
			// For absolute URLs: must match same origin and be a permitted endpoint
			const u = new URL(input, this.config.baseUrl);
			const base = new URL(this.config.baseUrl);
			if (u.origin === base.origin) {
				const path = u.pathname;
				if (OAuth2AuthorizationServer.ALLOWED_RETURN_PATHS.includes(path)) {
					// Only return the canonical absolute URL without user-provided query/fragment
					return (new URL(path, this.config.baseUrl)).toString();
				}
			}
			return this.config.authorizationEndpoint;
		} catch {
			return this.config.authorizationEndpoint;
		}
	}

	/**
	 * Handle login submission
	 */
	private async handleLogin(req: Request, res: Response) {
		try {
			const receivedToken = req.body._csrf;
			const sessionId = !this.config.baseUrl.startsWith('https') ? `local-session-${req.ip || '127.0.0.1'}` : 'session-based';
			this.securityLogger.debug(`Processing login submission - Received token: ${receivedToken?.substring(0, 10)}..., Session ID: ${sessionId}`);
			const { email, password, return_url } = req.body;
			const returnUrl = return_url || this.config.authorizationEndpoint;

			if (!email || !password) {
				const normalizedReturnUrl = this.normalizeReturnUrl(returnUrl);
				return res.redirect(`${this.config.loginEndpoint}?error=missing_credentials&return_url=${encodeURIComponent(normalizedReturnUrl)}`);
			}

			// Use custom authenticator if provided, otherwise use demo authentication
			let user: AuthenticatedUser | null = null;

			if (this.authenticateUser) {
				user = await this.authenticateUser({ email, password });
			} else {
				// Demo authentication - check against in-memory users
				const demoUser = this.users.get(email);
				if (demoUser && (password === '123456' || password === 'admin123')) {
					user = { ...demoUser };
				}
			}

			if (!user) {
				const normalizedReturnUrl = this.normalizeReturnUrl(returnUrl);
				return res.redirect(`${this.config.loginEndpoint}?error=invalid_credentials&return_url=${encodeURIComponent(normalizedReturnUrl)}`);
			}

			// Set user session
			(req.session as any).user = user;
			(req.session as any).isAuthenticated = true;

			this.securityLogger.info('User authenticated successfully', { userId: user.userId, email: user.email });

			// Check if we have stored OAuth parameters from the original authorization request
			const session = req.session as any;
			if (session?.oauthParams) {
				// Restore the original OAuth authorization URL with all parameters
				const oauthParams = session.oauthParams;
				const authUrl = new URL(this.config.authorizationEndpoint, this.config.baseUrl);

				// Add all OAuth parameters back to the authorization URL
				authUrl.searchParams.set('response_type', oauthParams.response_type);
				authUrl.searchParams.set('client_id', oauthParams.client_id);
				authUrl.searchParams.set('redirect_uri', oauthParams.redirect_uri);
				if (oauthParams.scope) authUrl.searchParams.set('scope', oauthParams.scope);
				if (oauthParams.state) authUrl.searchParams.set('state', oauthParams.state);
				if (oauthParams.code_challenge) authUrl.searchParams.set('code_challenge', oauthParams.code_challenge);
				if (oauthParams.code_challenge_method) authUrl.searchParams.set('code_challenge_method', oauthParams.code_challenge_method);

				// Clear the stored OAuth parameters
				delete session.oauthParams;

				this.securityLogger.debug(`Redirecting to authorization with restored OAuth params: ${authUrl.toString()}`);
				return res.redirect(authUrl.toString());
			}

			// Fallback: use the normalized return URL (without OAuth parameters)
			const safeReturnUrl = this.normalizeReturnUrl(returnUrl);
			res.redirect(safeReturnUrl);

		} catch (error: any) {
			this.securityLogger.error('Login error:', error);
			res.redirect(`${this.config.loginEndpoint}?error=server_error`);
		}
	}

	/**
	 * Handle authorization endpoint (user consent) with CSRF token from forms
	 */
	private handleAuthorize(req: Request, res: Response) {
		try {
			const params = req.query as unknown as AuthorizeRequest;

			// Validate required parameters
			const validation = this.validateAuthorizeRequest(params);
			if (!validation.valid) {
				return this.sendErrorRedirect(res, params.redirect_uri, validation.error!, validation.errorDescription, params.state);
			}

			// Get client information
			const client = oAuth2ClientManager.getClient(params.client_id);
			if (!client) {
				return this.sendError(res, 'invalid_client', 'Client not found');
			}

			// Validate redirect URI
			if (!oAuth2ClientManager.isValidRedirectUri(params.client_id, params.redirect_uri)) {
				return this.sendError(res, 'invalid_request', 'Invalid redirect URI');
			}
			// Enforce PKCE for public clients
			if (client.clientType === 'public') {
				if (!params.code_challenge || (process.env.NODE_ENV === 'production' && params.code_challenge_method !== 'S256')) {
					return this.sendErrorRedirect(res, params.redirect_uri, 'invalid_request', 'PKCE (S256) is required for public clients', params.state);
				}
			}

			// Check if user is authenticated
			const session = req.session as any;
			if (!session?.isAuthenticated || !session?.user) {
				// Store OAuth parameters in session before redirecting to login
				session.oauthParams = {
					response_type: params.response_type,
					client_id: params.client_id,
					redirect_uri: params.redirect_uri,
					scope: params.scope,
					state: params.state,
					code_challenge: params.code_challenge,
					code_challenge_method: params.code_challenge_method,
					originalUrl: req.originalUrl
				};
				// Redirect to login with return URL
				const safeOriginal = this.normalizeReturnUrl(req.originalUrl);
				const loginUrl = `${this.config.loginEndpoint}?return_url=${encodeURIComponent(safeOriginal)}`;
				return res.redirect(loginUrl);
			}

			// Generate CSRF token for consent form
			const csrfToken = this.generateToken(req, res);

			// Show consent form for authenticated user
			res.send(this.generateConsentForm(params, client, session.user, csrfToken));

		} catch (error: any) {
			this.securityLogger.error('Authorization endpoint error:', error);
			res.status(500).json({
				error: 'server_error',
				error_description: 'Internal server error'
			});
			return;
		}
	}

	/**
	 * Handle authorization consent submission
	 */
	private handleAuthorizationConsent(req: Request, res: Response) {
		try {
			const {
				client_id,
				redirect_uri,
				scope,
				state,
				code_challenge,
				code_challenge_method,
				user_consent
			} = req.body;

			// Check user session
			const session = req.session as any;
			if (!session?.isAuthenticated || !session?.user) {
				return this.sendErrorRedirect(res, redirect_uri, 'access_denied', 'User not authenticated', state);
			}

			// Validate consent
			if (user_consent !== 'approve') {
				return this.sendErrorRedirect(res, redirect_uri, 'access_denied', 'User denied authorization', state);
			}

			const user = session.user as AuthenticatedUser;

			// Load client and clamp scopes to what's registered
			const client = oAuth2ClientManager.getClient(client_id);
			if (!client) {
				return this.sendErrorRedirect(res, redirect_uri, 'invalid_client', 'Client not found', state);
			}
			const requestedScopes = scope ? scope.split(' ') : ['mcp.read'];
			const grantedScopes = requestedScopes.filter(s => client.scopes.includes(s));
			if (grantedScopes.length === 0) {
				return this.sendErrorRedirect(res, redirect_uri, 'invalid_scope', 'No permitted scopes requested', state, client_id);
			}

			// Re-validate redirect URI (defense-in-depth)
			if (!oAuth2ClientManager.isValidRedirectUri(client_id, redirect_uri)) {
				return this.sendErrorRedirect(res, redirect_uri, 'invalid_request', 'Invalid redirect URI', state);
			}

			// Generate authorization code
			const code = oAuth2AuthorizationCodeManager.generateAuthorizationCode(
				client_id,
				user.userId,
				redirect_uri,
				grantedScopes,
				{
					state,
					codeChallenge: code_challenge,
					codeChallengeMethod: code_challenge_method
				}
			);

			// Log authorization grant
			this.securityLogger.info('Authorization code granted', {
				userId: user.userId,
				clientId: client_id,
				scopes: grantedScopes.join(' '),
				codeChallenge: code_challenge ? 'present' : 'absent'
			});

			// Redirect with authorization code
			const redirectUrl = new URL(redirect_uri);
			redirectUrl.searchParams.append('code', code);
			if (state) {
				redirectUrl.searchParams.append('state', state);
			}

			res.redirect(redirectUrl.toString());

		} catch (error: any) {
			this.securityLogger.error('Authorization consent error:', error);
			res.status(500).json({
				error: 'server_error',
				error_description: 'Internal server error'
			});
			return;
		}
	}

	/**
	 * Handle token endpoint
	 */
	private async handleToken(req: Request, res: Response): Promise<void> {
		try {
			const params = req.body as TokenRequest;

			// Validate grant type
			if (!params.grant_type) {
				res.status(400).json({
					error: 'invalid_request',
					error_description: 'grant_type parameter is required'
				});
				return;
			}

			switch (params.grant_type) {
				case 'authorization_code':
					await this.handleAuthorizationCodeGrant(req, res, params);
					break;
				case 'refresh_token':
					await this.handleRefreshTokenGrant(req, res, params);
					break;
				case 'client_credentials':
					await this.handleClientCredentialsGrant(req, res, params);
					break;
				default:
					res.status(400).json({
						error: 'unsupported_grant_type',
						error_description: `Grant type ${params.grant_type} is not supported`
					});
					break;
			}

		} catch (error: any) {
			this.securityLogger.error('Token endpoint error:', error);
			res.status(500).json({
				error: 'server_error',
				error_description: 'Internal server error'
			});
			return;
		}
	}

	/**
	 * Handle authorization code grant
	 */
	private async handleAuthorizationCodeGrant(req: Request, res: Response, params: TokenRequest): Promise<void> {
		// Validate required parameters
		if (!params.code || !params.redirect_uri || !params.client_id) {
			res.status(400).json({
				error: 'invalid_request',
				error_description: 'Missing required parameters'
			});
			return;
		}

		// Validate client
		const client = await oAuth2ClientManager.validateClient(params.client_id, params.client_secret);
		if (!client) {
			res.status(401).json({
				error: 'invalid_client',
				error_description: 'Client authentication failed'
			});
			return;
		}

		// Exchange authorization code
		const authCode = oAuth2AuthorizationCodeManager.exchangeAuthorizationCode(
			params.code,
			params.client_id,
			params.redirect_uri,
			params.code_verifier
		);

		if (!authCode) {
			res.status(400).json({
				error: 'invalid_grant',
				error_description: 'Invalid authorization code'
			});
			return;
		}

		// Generate tokens
		const tokenPair = await this.tokenManager.generateTokenPair(
			authCode.userId,
			params.client_id,
			authCode.scopes,
			{ includeRefreshToken: true }
		);

		res.json({
			access_token: tokenPair.accessToken,
			token_type: tokenPair.tokenType,
			expires_in: tokenPair.expiresIn,
			refresh_token: tokenPair.refreshToken,
			scope: tokenPair.scope
		});
	}

	/**
	 * Handle refresh token grant
	 */
	private async handleRefreshTokenGrant(req: Request, res: Response, params: TokenRequest): Promise<void> {
		if (!params.refresh_token || !params.client_id) {
			res.status(400).json({
				error: 'invalid_request',
				error_description: 'Missing required parameters'
			});
			return;
		}

		// Validate client
		const client = await oAuth2ClientManager.validateClient(params.client_id, params.client_secret);
		if (!client) {
			res.status(401).json({
				error: 'invalid_client',
				error_description: 'Client authentication failed'
			});
			return;
		}

		// Refresh tokens
		const newTokenPair = await this.tokenManager.refreshAccessToken(params.refresh_token, params.client_id);
		if (!newTokenPair) {
			res.status(400).json({
				error: 'invalid_grant',
				error_description: 'Invalid refresh token'
			});
			return;
		}

		res.json({
			access_token: newTokenPair.accessToken,
			token_type: newTokenPair.tokenType,
			expires_in: newTokenPair.expiresIn,
			scope: newTokenPair.scope
		});
	}

	/**
	 * Handle client credentials grant
	 */
	private async handleClientCredentialsGrant(req: Request, res: Response, params: TokenRequest): Promise<void> {
		// Validate client credentials
		const client = await oAuth2ClientManager.validateClient(params.client_id, params.client_secret);
		if (!client) {
			res.status(401).json({
				error: 'invalid_client',
				error_description: 'Client authentication failed'
			});
			return;
		}

		// Parse requested scopes
		const requestedScopes = params.scope ? params.scope.split(' ') : ['mcp.read'];
		const allowedScopes = requestedScopes.filter(scope => client.scopes.includes(scope));

		if (allowedScopes.length === 0) {
			res.status(400).json({
				error: 'invalid_scope',
				error_description: 'No valid scopes requested'
			});
			return;
		}

		// Generate client credentials token (no refresh token)
		const tokenPair = await this.tokenManager.generateTokenPair(
			params.client_id, // Use client ID as subject for client credentials
			params.client_id,
			allowedScopes,
			{
				includeRefreshToken: false,
				customClaims: { token_use: 'client_credentials' }
			}
		);

		res.json({
			access_token: tokenPair.accessToken,
			token_type: tokenPair.tokenType,
			expires_in: tokenPair.expiresIn,
			scope: tokenPair.scope
		});
	}

	/**
	 * Handle client registration
	 */
	private async handleClientRegistration(req: Request, res: Response) {
		try {
			const registrationResponse = await oAuth2ClientManager.registerClient(req.body);
			res.status(201).json(registrationResponse);
		} catch (error: any) {
			this.securityLogger.error('Client registration error:', error);
			res.status(400).json({
				error: 'invalid_request',
				error_description: error.message
			});
			return;
		}
	}

	/**
	 * Handle token introspection (RFC 7662)
	 */
	private async handleTokenIntrospection(req: Request, res: Response): Promise<void> {
		try {
			const { token, token_type_hint } = req.body as IntrospectionRequest;

			if (!token) {
				res.status(400).json({
					error: 'invalid_request',
					error_description: 'token parameter is required'
				});
				return;
			}

			// Validate the requesting client (simplified - in production, implement proper client auth)
			const authHeader = req.headers.authorization;
			if (!authHeader || !authHeader.startsWith('Basic ')) {
				res.status(401).json({
					error: 'invalid_client',
					error_description: 'Client authentication (Basic) required'
				});
				return;
			}

			// Validate the token
			const validation = await this.oAuthValidator.validateToken(token);

			if (!validation.valid) {
				// Token is invalid or expired
				res.json({
					active: false
				} as IntrospectionResponse);
				return;
			}

			// Token is active, return token information
			const response: IntrospectionResponse = {
				active: true,
				scope: validation.scopes?.join(' '),
				client_id: validation.clientId,
				username: validation.subject,
				token_type: 'Bearer',
				exp: validation.expires,
				iat: validation.payload?.iat,
				sub: validation.subject,
				aud: validation.audience as string,
				iss: this.config.issuer,
				jti: validation.payload?.jti
			};

			// Add additional claims if available
			if (validation.payload?.organizationId) {
				(response as any).organization_id = validation.payload.organizationId;
			}
			if (validation.payload?.tenantId) {
				(response as any).tenant_id = validation.payload.tenantId;
			}
			if (validation.payload?.roles) {
				(response as any).roles = validation.payload.roles;
			}

			this.securityLogger.info('Token introspection performed', {
				active: response.active,
				clientId: validation.clientId,
				subject: validation.subject
			});

			res.json(response);

		} catch (error: any) {
			this.securityLogger.error('Token introspection error:', error);
			res.status(500).json({
				error: 'server_error',
				error_description: 'Internal server error'
			});
			return;
		}
	}

	/**
	 * Handle user info endpoint (OpenID Connect)
	 */
	private async handleUserInfo(req: Request, res: Response): Promise<void> {
		try {
			// Extract access token from Authorization header
			const authHeader = req.headers.authorization;
			if (!authHeader || !authHeader.startsWith('Bearer ')) {
				res.status(401).json({
					error: 'invalid_token',
					error_description: 'Bearer token required'
				});
				return;
			}

			const token = authHeader.substring(7); // Remove 'Bearer ' prefix

			// Validate the access token
			const validation = await this.oAuthValidator.validateToken(token);

			if (!validation.valid) {
				res.status(401).json({
					error: 'invalid_token',
					error_description: validation.error || 'Token validation failed'
				});
				return;
			}

			// Check if token has required scope for userinfo
			const hasUserInfoScope = validation.scopes?.some(scope =>
				scope === 'openid' || scope === 'profile' || scope === 'email'
			);

			if (!hasUserInfoScope) {
				res.status(403).json({
					error: 'insufficient_scope',
					error_description: 'Token does not have required scope for user info'
				});
				return;
			}

			// Get user information
			let userInfo: UserInfo | null = null;

			if (this.userInfoProvider) {
				userInfo = await this.userInfoProvider(validation.subject!);
			} else {
				// Use in-memory user store for demo
				for (const user of this.users.values()) {
					if (user.userId === validation.subject) {
						userInfo = user;
						break;
					}
				}
			}

			if (!userInfo) {
				res.status(404).json({
					error: 'user_not_found',
					error_description: 'User information not available'
				});
				return;
			}

			// Build userinfo response based on scopes
			const userInfoResponse: any = {
				sub: userInfo.userId
			};

			// Add claims based on granted scopes
			if (validation.scopes?.includes('profile')) {
				userInfoResponse.name = userInfo.name;
				userInfoResponse.picture = userInfo.picture;
			}

			if (validation.scopes?.includes('email')) {
				userInfoResponse.email = userInfo.email;
				userInfoResponse.email_verified = userInfo.emailVerified ?? true;
			}

			// Add custom claims
			if (userInfo.organizationId) {
				userInfoResponse.organization_id = userInfo.organizationId;
			}
			if (userInfo.tenantId) {
				userInfoResponse.tenant_id = userInfo.tenantId;
			}
			if (userInfo.roles && validation.scopes?.includes('roles')) {
				userInfoResponse.roles = userInfo.roles;
			}

			this.securityLogger.info('User info retrieved', {
				userId: userInfo.userId,
				scopes: validation.scopes?.join(' ')
			});

			res.json(userInfoResponse);

		} catch (error: any) {
			this.securityLogger.error('User info endpoint error:', error);
			res.status(500).json({
				error: 'server_error',
				error_description: 'Internal server error'
			});
			return;
		}
	}

	/**
	 * Validate authorize request parameters
	 */
	private validateAuthorizeRequest(params: AuthorizeRequest): { valid: boolean; error?: string; errorDescription?: string } {
		if (!params.response_type) {
			return { valid: false, error: 'invalid_request', errorDescription: 'response_type parameter is required' };
		}

		if (params.response_type !== 'code') {
			return { valid: false, error: 'unsupported_response_type', errorDescription: 'Only code response type is supported' };
		}

		if (!params.client_id) {
			return { valid: false, error: 'invalid_request', errorDescription: 'client_id parameter is required' };
		}

		if (!params.redirect_uri) {
			return { valid: false, error: 'invalid_request', errorDescription: 'redirect_uri parameter is required' };
		}

		return { valid: true };
	}

	/**
	 * Generate login form with CSRF token
	 */
	private generateLoginForm(error?: string, returnUrl?: string, csrfToken?: string): string {
		const errorMessage = error ? this.getErrorMessage(error) : '';

		return `
			<!DOCTYPE html>
			<html>
			<head>
				<title>Sign In - Gauzy MCP OAuth Server</title>
				<meta charset="utf-8">
				<meta name="viewport" content="width=device-width, initial-scale=1">
				<style>
					body { font-family: Arial, sans-serif; max-width: 400px; margin: 100px auto; padding: 20px; background: #f5f5f5; }
					.card { border: 1px solid #ddd; border-radius: 8px; padding: 30px; background: #fff; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
					.logo { text-align: center; margin-bottom: 30px; }
					.logo h1 { color: #333; margin: 0; font-size: 24px; }
					.logo p { color: #666; margin: 5px 0 0 0; font-size: 14px; }
					.form-group { margin-bottom: 20px; }
					label { display: block; margin-bottom: 5px; color: #333; font-weight: bold; }
					input[type="email"], input[type="password"] { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 16px; box-sizing: border-box; }
					input[type="email"]:focus, input[type="password"]:focus { outline: none; border-color: #007bff; }
					.btn { width: 100%; padding: 12px; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; margin-top: 10px; }
					.btn-primary { background: #007bff; color: white; }
					.btn-primary:hover { background: #0056b3; }
					.error { color: #dc3545; margin-bottom: 15px; padding: 10px; background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; }
					.demo-info { margin-top: 20px; padding: 15px; background: #e7f3ff; border: 1px solid #bee5eb; border-radius: 4px; font-size: 14px; }
					.demo-info strong { color: #0c5460; }
				</style>
			</head>
			<body>
				<div class="card">
					<div class="logo">
						<h1>🔐 MCP OAuth</h1>
						<p>Sign in to authorize applications</p>
					</div>

					${errorMessage ? `<div class="error">${escapeHtml(errorMessage)}</div>` : ''}

					<form method="POST" action="${escapeHtml(this.config.loginEndpoint || '')}">
            			<input type="hidden" name="_csrf" value="${escapeHtml(csrfToken || '')}" />
						<input type="hidden" name="return_url" value="${escapeHtml(returnUrl || '')}">

						<div class="form-group">
							<label for="email">Email Address</label>
							<input type="email" id="email" name="email" required placeholder="Enter your email address">
						</div>

						<div class="form-group">
							<label for="password">Password</label>
							<input type="password" id="password" name="password" required placeholder="Enter your password">
						</div>

						<button type="submit" class="btn btn-primary">Sign In</button>
					</form>

					<div class="demo-info">
						<strong>Demo Credentials:</strong><br>
						Email: employee@ever.co / Password: 123456<br>
						Email: admin@ever.co / Password: admin123
					</div>
				</div>
			</body>
			</html>
		`;
	}

	/**
	 * Get human-readable error message
	 */
	private getErrorMessage(error: string): string {
		const messages: { [key: string]: string } = {
			'missing_credentials': 'Please enter both email and password.',
			'invalid_credentials': 'Invalid email or password. Please try again.',
			'server_error': 'An error occurred. Please try again later.'
		};
		return messages[error] || 'An error occurred during sign in.';
	}

	/**
	 * Generate user consent form with CSRF token
	 */
	private generateConsentForm(params: AuthorizeRequest, client: OAuth2Client, user?: AuthenticatedUser, csrfToken?: string): string {
		const scopes = params.scope ? params.scope.split(' ') : ['mcp.read'];
		const scopeDescriptions = {
			'mcp.read': 'Read access to your MCP data and tools',
			'mcp.write': 'Write access to modify your MCP data',
			'mcp.admin': 'Administrative access to manage your MCP resources',
			'openid': 'Access to your identity information',
			'profile': 'Access to your basic profile information',
			'email': 'Access to your email address',
			'roles': 'Access to your role and permission information'
		};

		return `
			<!DOCTYPE html>
			<html>
			<head>
				<title>Authorize ${escapeHtml(client.clientName)}</title>
				<meta charset="utf-8">
				<meta name="viewport" content="width=device-width, initial-scale=1">
				<style>
					body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; background: #f5f5f5; }
					.card { border: 1px solid #ddd; border-radius: 8px; padding: 30px; background: #fff; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
					.header { text-align: center; margin-bottom: 30px; }
					.app-icon { width: 64px; height: 64px; border-radius: 8px; margin-bottom: 20px; }
					h1 { color: #333; margin-bottom: 10px; font-size: 24px; }
					.subtitle { color: #666; margin-bottom: 20px; }
					.user-info { background: #e7f3ff; border: 1px solid #bee5eb; border-radius: 6px; padding: 15px; margin-bottom: 25px; }
					.user-info strong { color: #0c5460; }
					.scopes { margin: 20px 0; }
					.scopes h3 { color: #333; margin-bottom: 15px; font-size: 16px; }
					.scope { padding: 12px; margin: 8px 0; background: #f8f9fa; border-left: 4px solid #007bff; border-radius: 4px; }
					.scope-name { font-weight: bold; color: #007bff; }
					.scope-desc { color: #666; font-size: 14px; margin-top: 4px; }
					.warning { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 15px; margin: 20px 0; }
					.warning strong { color: #856404; }
					.buttons { margin-top: 30px; text-align: center; }
					button { padding: 14px 30px; margin: 0 10px; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; font-weight: bold; transition: all 0.2s; }
					.approve { background: #28a745; color: white; }
					.deny { background: #6c757d; color: white; }
					.approve:hover { background: #218838; transform: translateY(-1px); }
					.deny:hover { background: #545b62; transform: translateY(-1px); }
					.footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #999; text-align: center; }
					.security-info { margin-top: 15px; font-size: 11px; color: #666; }
				</style>
			</head>
			<body>
				<div class="card">
					<div class="header">
						${client.logoUri ? `<img src="${escapeHtml(client.logoUri)}" alt="${escapeHtml(client.clientName)}" class="app-icon">` : ''}
						<h1>Authorize ${escapeHtml(client.clientName)}</h1>
						<p class="subtitle">${escapeHtml(client.clientName)} wants to access your MCP account</p>
					</div>

					${user ? `
						<div class="user-info">
							<strong>Signed in as:</strong> ${escapeHtml(user.name || user.email)}<br>
							<small>${escapeHtml(user.email)}${user.organizationId ? ` • ${escapeHtml(user.organizationId)}` : ''}</small>
						</div>
					` : ''}

					<div class="scopes">
						<h3>📋 Requested Permissions</h3>
						${scopes.map(scope => `
							<div class="scope">
								<div class="scope-name">${escapeHtml(scope)}</div>
								<div class="scope-desc">${escapeHtml(scopeDescriptions[scope as keyof typeof scopeDescriptions] || 'Custom permission for this application')}</div>
							</div>
						`).join('')}
					</div>

					<div class="warning">
						<strong>⚠️ Security Notice:</strong> Only authorize applications you trust. This will give ${escapeHtml(client.clientName)} access to the permissions listed above.
					</div>

					<form method="POST" action="${escapeHtml(this.config.authorizationEndpoint)}">
            			<input type="hidden" name="_csrf" value="${escapeHtml(csrfToken || '')}" />
						<input type="hidden" name="client_id" value="${escapeHtml(params.client_id)}">
						<input type="hidden" name="redirect_uri" value="${escapeHtml(params.redirect_uri)}">
						<input type="hidden" name="scope" value="${escapeHtml(params.scope || '')}">
						<input type="hidden" name="state" value="${escapeHtml(params.state || '')}">
						<input type="hidden" name="code_challenge" value="${escapeHtml(params.code_challenge || '')}">
						<input type="hidden" name="code_challenge_method" value="${escapeHtml(params.code_challenge_method || '')}">

						<div class="buttons">
							<button type="submit" name="user_consent" value="approve" class="approve">✓ Authorize</button>
							<button type="submit" name="user_consent" value="deny" class="deny">✗ Deny</button>
						</div>
					</form>

					<div class="footer">
						<p>By clicking "Authorize", you allow ${escapeHtml(client.clientName)} to access your account using the permissions above.</p>
						<div class="security-info">
							<strong>Client ID:</strong> ${escapeHtml(params.client_id)}<br>
							<strong>Redirect URI:</strong> ${escapeHtml(params.redirect_uri)}<br>
							${params.state ? `<strong>State:</strong> ${escapeHtml(params.state)}<br>` : ''}
							<strong>PKCE:</strong> ${params.code_challenge ? 'Enabled (Enhanced Security)' : 'Not Used'}
						</div>
					</div>
				</div>
			</body>
			</html>
		`;
	}

	/**
	 * Send error response
	 */
	private sendError(res: Response, error: string, errorDescription?: string) {
		res.status(400).json({
			error,
			error_description: errorDescription
		});
	}

	/**
	 * Send error redirect
	 */
	private sendErrorRedirect(
		res: Response,
		redirectUri: string | undefined,
		error: string,
		errorDescription?: string,
		state?: string,
		clientId?: string
		) {
		if (!redirectUri) {
			return this.sendError(res, error, errorDescription);
		}

		try {
			let url: URL;
			if (clientId && oAuth2ClientManager.isValidRedirectUri(clientId, redirectUri)) {
				// Safe to redirect to the validated client redirect_uri (can be external)
				url = new URL(redirectUri);
			} else {
				// Fallback to a safe local endpoint
				const safe = this.normalizeReturnUrl(redirectUri);
				url = new URL(safe, this.config.baseUrl);
			}
			url.searchParams.append('error', error);
			if (errorDescription) {
				url.searchParams.append('error_description', errorDescription);
			}
			if (state) {
				url.searchParams.append('state', state);
			}
			res.redirect(url.toString());
		} catch {
			this.sendError(res, error, errorDescription);
		}
	}

	/**
	 * Get Express app instance
	 */
	getApp(): express.Application {
		return this.app;
	}

	/**
	 * Get token manager instance
	 */
	getTokenManager(): OAuth2TokenManager {
		return this.tokenManager;
	}

	/**
	 * Get server statistics
	 */
	getStats() {
		return {
			clients: oAuth2ClientManager.listClients().length,
			authorizationCodes: oAuth2AuthorizationCodeManager.getStats(),
			tokens: this.tokenManager.getStats()
		};
	}

	/**
	 * Register error handling with CSRF error support
	 */
	private setupErrorHandling() {
		this.app.use((error: any, req: Request, res: Response, next: NextFunction): void => {
			if (error?.code === 'EBADCSRFTOKEN') {
				this.securityLogger.warn('CSRF token validation failed', {
					ip: req.ip,
					userAgent: req.get('User-Agent'),
					url: req.originalUrl
				});

				// For OAuth redirects, send error to redirect_uri if available
				if (req.body.redirect_uri && req.body.state) {
					this.sendErrorRedirect(res, req.body.redirect_uri, 'invalid_request', 'CSRF protection failed', req.body.state);
					return;
				}

				res.status(403).json({
					error: 'invalid_request',
					error_description: 'CSRF protection failed. Please try again.'
				});
				return;
			}

			// Handle other errors
			this.securityLogger.error('Unhandled error:', error);
			res.status(500).json({
				error: 'server_error',
				error_description: 'Internal server error'
			});
		});
	}
}
