import { Logger } from '@nestjs/common';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { Server } from 'node:http';
import { McpTransportConfig } from '../common/config';
import { sessionManager, sessionMiddleware, UserContext } from '../session';
import { PROTOCOL_VERSION } from '../config';
import { ExtendedMcpServer, ToolDescriptor } from '../mcp-server';
import { validateMCPToolInput, validateRequestSize } from '../common/security-config';
import { AuthorizationConfig, loadAuthorizationConfig, ResponseBuilder } from '../common/auth-types';
import { sanitizeErrorMessage } from '../common/error-utils';
import { SecurityEvents, SecurityLogger } from '../common/security-logger';
import { AuthorizationMiddleware, AuthorizedRequest } from '../common/authorization-middleware';

const logger = new Logger('HttpTransport');

// JSON-RPC 2.0 interfaces
interface JsonRpcRequest {
	jsonrpc: '2.0';
	id?: string | number | null;
	method: string;
	params?: Record<string, unknown> | unknown[];
}

interface JsonRpcResponse {
	jsonrpc: '2.0';
	id?: string | number | null;
	result?: unknown;
}

interface JsonRpcError {
	code: number;
	message: string;
	data?: unknown;
}

interface JsonRpcErrorResponse {
	jsonrpc: '2.0';
	id?: string | number | null;
	error: JsonRpcError;
}

// MCP Response types
type McpResponse = JsonRpcResponse | JsonRpcErrorResponse;

// MCP Transport interface
interface McpTransport {
	start(): Promise<void>;
	close(): Promise<void>;
	send(response: JsonRpcResponse | JsonRpcErrorResponse): void;
}

// Mock Transport interface for HTTP implementation
type MockTransport = McpTransport;

export interface HttpTransportOptions {
	server: ExtendedMcpServer;
	transportConfig: McpTransportConfig['http'];
}

export class HttpTransport {
	private app: express.Application;
	private httpServer: Server | null = null;
	private mcpServer: ExtendedMcpServer;
	private securityLogger: SecurityLogger;
	private transportConfig: McpTransportConfig['http'];
	private isInitialized = false;
	private authorizationConfig: AuthorizationConfig;
	private authorizationMiddleware: AuthorizationMiddleware | null = null;

	constructor(options: HttpTransportOptions) {
		this.mcpServer = options.server;
		this.securityLogger = new SecurityLogger();
		this.transportConfig = options.transportConfig;
		this.authorizationConfig = loadAuthorizationConfig();

		// Initialize authorization middleware if enabled
		if (this.authorizationConfig.enabled) {
			// IMPORTANT: The MCP Server (port 3001) should NOT have an embedded OAuth server
			// OAuth endpoints should ONLY be available on the dedicated OAuth Server (port 3003)
			// This server only needs to VALIDATE tokens, not issue them
			logger.log('OAuth 2.0 authorization enabled with external server configuration');
			logger.log(
				`External OAuth Server: ${this.authorizationConfig.authorizationServers[0]?.issuer || 'Not configured'}`
			);
			logger.log(`Resource URI: ${this.authorizationConfig.resourceUri || 'Not configured'}`);

			this.authorizationMiddleware = new AuthorizationMiddleware(this.authorizationConfig);
			logger.log('OAuth 2.0 authorization middleware initialized for token validation only');
		}

		this.app = express();
		this.setupMiddleware();
		this.setupRoutes();
	}

	private setupMiddleware() {
		// Hide Express signature
		this.app.disable('x-powered-by');

		// Configure trust proxy to honor X-Forwarded-For headers from trusted proxies
		if (this.transportConfig.trustedProxies && this.transportConfig.trustedProxies.length > 0) {
			const normalizedProxies = this.transportConfig.trustedProxies.map((p) => p.trim()).filter(Boolean);
			this.app.set('trust proxy', normalizedProxies);
			logger.log(`Trust proxy enabled for: ${normalizedProxies.join(', ')}`);
		} else if (process.env.NODE_ENV === 'production') {
			this.securityLogger.warn(
				'⚠️  Trusted proxies not configured in production. Trusting all proxies may allow IP spoofing.'
			);
			this.app.set('trust proxy', true);
			logger.log('Trust proxy enabled for all proxies (production mode)');
		}

		// CORS configuration
		this.app.use(
			cors({
				origin: this.transportConfig.cors.origin,
				credentials: this.transportConfig.cors.credentials,
				methods: ['GET', 'POST', 'OPTIONS', 'DELETE'],
				allowedHeaders: [
					'Content-Type',
					'Authorization',
					'mcp-session-id',
					'mcp-csrf-token',
					'X-CSRF-Token',
					'x-csrf-token'
				]
			})
		);

		// Global security headers middleware - applied to ALL routes
		this.app.use((req, res, next) => {
			ResponseBuilder.setSecurityHeaders(res);
			next();
		});

		// JSON parsing with enhanced validation
		this.app.use(
			express.json({
				limit: process.env.NODE_ENV === 'production' ? '1mb' : '10mb',
				verify: (req, res, buf) => {
					const validation = validateRequestSize(
						buf,
						process.env.NODE_ENV === 'production' ? 1024 * 1024 : 10 * 1024 * 1024
					);
					if (!validation.valid) {
						const clientIP = this.normalizeIP(req.socket?.remoteAddress || 'unknown');
						if (validation.error === 'Request too large') {
							SecurityLogger.logSecurityEvent(SecurityEvents.LARGE_REQUEST, 'medium', {
								size: buf.length,
								ip: clientIP,
								error: validation.error
							});
						} else {
							SecurityLogger.logSecurityEvent(SecurityEvents.SUSPICIOUS_PAYLOAD, 'medium', {
								size: buf.length,
								ip: clientIP,
								error: validation.error
							});
						}

						// Map size errors to proper HTTP status
						if (validation.error === 'Request too large') {
							const error = new Error(validation.error) as any;
							error.status = 413;
							error.statusCode = 413;
							throw error;
						}
						const err: any = new Error(validation.error);
						err.status = 400;
						err.statusCode = 400;
						throw err;
					}
				}
			})
		);

		// Cookie parsing for session management
		// Note: CSRF protection is implemented below to prevent cross-site request forgery
		this.app.use(cookieParser());

		// URL-encoded body parsing (e.g., form submissions)
		this.app.use(express.urlencoded({ extended: true }));

		// CSRF protection middleware for state-changing operations
		// This protects against cross-site request forgery attacks by requiring
		// either a valid CSRF token in session-based requests or OAuth Bearer tokens
		this.app.use(this.createCSRFProtectionMiddleware());

		// Error handling middleware for request validation errors
		this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction): void => {
			// Skip if response already sent
			if (res.headersSent) {
				next(err);
				return;
			}

			const statusCode = Number(err.status || err.statusCode) || 500;
			const sanitizedMessage = sanitizeErrorMessage(err.message || 'Unknown error');

			if (statusCode === 413) {
				res.status(413).json({
					error: 'Payload Too Large',
					message: sanitizedMessage
				});
				return;
			}

			if (statusCode === 400) {
				res.status(400).json({
					error: 'Bad Request',
					message: sanitizedMessage
				});
				return;
			}

			// For all other errors, return generic 500
			res.status(500).json({
				error: 'Internal server error'
			});
		});

		// Request logging
		this.app.use((req, res, next) => {
			logger.debug(
				`${req.method} ${req.path} from ${this.getClientIP(req, this.transportConfig.trustedProxies || [])}`
			);
			next();
		});

		// Session management middleware (applied to protected routes)
		if (this.transportConfig.session.enabled) {
			this.setupSessionMiddleware();
		}
	}

	/**
	 * Create CSRF protection middleware to prevent cross-site request forgery attacks
	 * This middleware validates CSRF tokens for state-changing requests while allowing
	 * OAuth Bearer tokens to bypass CSRF protection (correct for API access)
	 */
	private createCSRFProtectionMiddleware() {
		return (req: express.Request, res: express.Response, next: express.NextFunction) => {
			// Skip CSRF for safe methods and excluded paths
			const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
			const excludedPrefixes = ['/health', '/.well-known/'];
			const excludedExactPaths = ['/sse/session']; // allow unauthenticated session creation

			if (
				safeMethods.includes(req.method) ||
				excludedPrefixes.some((p) => req.path.startsWith(p)) ||
				excludedExactPaths.includes(req.path)
			) {
				return next();
			}

			// For state-changing requests, require either:
			// 1. Valid session with CSRF token, or
			// 2. Valid OAuth Bearer token (API access)
			const hasBearerToken = /^Bearer\s+\S+$/.test(req.headers.authorization || '');
			const oauthProtectedPrefixes = ['/sse', '/sse/events'];
			const onOauthProtectedRoute =
				oauthProtectedPrefixes.some((p) => req.path.startsWith(p)) && !req.path.startsWith('/sse/session');
			const sessionId = req.sessionId || req.cookies?.[this.transportConfig.session?.cookieName || 'session'];
			const csrfHeaderName = req.get('mcp-csrf-token')
				? 'mcp-csrf-token'
				: req.get('x-csrf-token')
				? 'x-csrf-token'
				: null;

			if (hasBearerToken && onOauthProtectedRoute) {
				// OAuth Bearer tokens are self-authenticating, skip CSRF
				return next();
			}

			if (sessionId && csrfHeaderName && sessionMiddleware.validateCSRFToken(req, sessionId, csrfHeaderName)) {
				// Valid session-based CSRF token
				return next();
			}

			// Missing or invalid CSRF protection
			res.status(403).json({
				error: 'CSRF protection required',
				message: 'Include mcp-csrf-token or x-csrf-token header, or use Bearer authentication'
			});
		};
	}

	private setupSessionMiddleware() {
		// Create session middleware for protected MCP routes
		const mcpSessionMiddleware = sessionMiddleware.createSessionMiddleware({
			requireAuth: false, // MCP endpoints handle their own auth validation
			validateIP: false,
			validateUserAgent: false,
			enableCSRF: true,
			enableRateLimit: false,
			excludedPaths: [
				'/health',
				'/sse/session*', // retains exclusion for immediate session routes
				'/sse/session/**' // adds exclusion for any deeper subpaths
			],
			trustedProxies: this.transportConfig.trustedProxies || []
		});

		// Rate limiting middleware
		const rateLimitMiddleware = sessionMiddleware.createRateLimitMiddleware({
			windowMs: 15 * 60 * 1000, // 15 minutes
			max: 100, // 100 requests per windowMs per session/IP
			trustedProxies: this.transportConfig.trustedProxies || []
		});

		// Apply middleware to MCP routes
		this.app.use('/sse', rateLimitMiddleware);
		this.app.use('/sse', mcpSessionMiddleware);
	}

	private setupRoutes() {
		// NOTE: OAuth 2.0 authorization server routes are NOT mounted here
		// They are available on the dedicated OAuth Server (port 3003)
		// This server (MCP Server on port 3001) only validates tokens, it does not issue them

		// OAuth 2.0 Protected Resource Metadata endpoint (RFC 9728)
		if (this.authorizationMiddleware) {
			this.app.get(
				'/.well-known/oauth-protected-resource',
				this.authorizationMiddleware.createProtectedResourceMetadataMiddleware()
			);
		}

		// Health check endpoint (no session required)
		this.app.get('/health', (req, res) => {
			const sessionStats = this.transportConfig.session.enabled ? sessionManager.getStats() : null;

			res.json({
				status: 'healthy',
				timestamp: new Date().toISOString(),
				transport: 'http',
				server: 'gauzy-mcp-server',
				...(this.authorizationConfig.enabled && {
					authorization: {
						enabled: true,
						resourceUri: this.authorizationConfig.resourceUri,
						externalAuthServer:
							this.authorizationConfig.authorizationServers[0]?.issuer || 'Not configured',
						note: 'This server validates tokens. OAuth endpoints are on the external auth server.'
					}
				}),
				...(sessionStats && {
					sessions: {
						total: sessionStats.totalSessions,
						active: sessionStats.activeSessions,
						connections: sessionStats.totalConnections
					}
				})
			});
		});

		// Apply authorization middleware to protected endpoints
		const authMiddleware = this.authorizationMiddleware?.createAuthorizationMiddleware({
			requiredScopes: this.authorizationConfig.requiredScopes,
			optional: false
		});

		// MCP Protocol endpoint - POST for requests (protected)
		this.app.post('/sse', ...(authMiddleware ? [authMiddleware] : []), async (req: AuthorizedRequest, res) => {
			try {
				await this.handleMcpRequest(req, res);
			} catch (error) {
				logger.error('Error handling MCP request:', error);
				res.status(500).json({
					error: 'Internal server error',
					message: error instanceof Error ? error.message : 'Unknown error'
				});
			}
		});

		// Server-Sent Events endpoint for streaming (protected)
		this.app.get('/sse/events', ...(authMiddleware ? [authMiddleware] : []), (req: AuthorizedRequest, res) => {
			try {
				this.handleMcpEventStream(req, res);
			} catch (error) {
				logger.error('Error setting up event stream:', error);
				res.status(500).json({
					error: 'Internal server error',
					message: error instanceof Error ? error.message : 'Unknown error'
				});
			}
		});

		// Session management endpoints
		if (this.transportConfig.session.enabled) {
			this.setupSessionRoutes();
		}
	}

	private setupSessionRoutes() {
		// Rate limiting for session endpoints
		const DEFAULT_SESSION_RATE_LIMIT = 50;
		const maxRequests = Math.max(
			Number.parseInt(process.env.MCP_SESSION_RATE_LIMIT || '', 10) || DEFAULT_SESSION_RATE_LIMIT,
			1
		);
		const sessionRateLimit = rateLimit({
			windowMs: 15 * 60 * 1000, // 15 minutes
			max: maxRequests,
			message: {
				error: 'Too many session requests',
				message: 'Rate limit exceeded for session endpoints',
				retryAfter: '15 minutes'
			},
			standardHeaders: true,
			legacyHeaders: false,
			skip: (req) => {
				// Skip rate limiting for localhost in development
				if (process.env.NODE_ENV !== 'production') {
					const ip = this.normalizeIP(req.ip || req.socket?.remoteAddress || '');
					return ip === '127.0.0.1' || ip === '::1';
				}
				return false;
			}
		});

		// Create session endpoint
		this.app.post('/sse/session', sessionRateLimit, async (req, res) => {
			try {
				// For authenticated session creation, validate CSRF token
				const requestCsrfToken = req.get('mcp-csrf-token');
				if (req.sessionId && requestCsrfToken) {
					if (!sessionMiddleware.validateCSRFToken(req, req.sessionId, 'mcp-csrf-token')) {
						res.status(403).json({
							error: 'Invalid CSRF token',
							message: 'CSRF validation failed'
						});
						return;
					}
				}
				const { userId, userEmail, organizationId, tenantId, autoAuthenticate = true } = req.body;

				const session = await sessionManager.createSession({
					userId,
					userEmail,
					organizationId,
					tenantId,
					ipAddress: this.getClientIP(req),
					userAgent: req.get('User-Agent'),
					loginSource: 'http',
					autoAuthenticate,
					metadata: {
						createdVia: 'http-endpoint',
						userAgent: req.get('User-Agent'),
						origin: req.get('Origin')
					}
				});

				// Generate CSRF token for the session
				const csrfToken = sessionMiddleware.generateCSRFToken(session.id);

				// Set session cookie if cookie name is configured
				const cookieName = this.transportConfig.session.cookieName;
				if (cookieName) {
					try {
						const maxAge = session.expiresAt
							? new Date(session.expiresAt).getTime() - Date.now()
							: 24 * 60 * 60 * 1000; // 24 hours default
						res.cookie(cookieName, session.id, {
							httpOnly: true,
							secure: req.secure || process.env.NODE_ENV === 'production',
							sameSite: 'lax',
							path: '/',
							maxAge: Math.max(0, maxAge) // Ensure non-negative
						});
					} catch (err) {
						logger.warn('Failed to set session cookie:', err);
					}
				}

				logger.log(
					`Session created: ${session.id} for user ${session.userId} from ${this.getClientIP(
						req,
						this.transportConfig.trustedProxies || []
					)}`
				);

				res.json({
					sessionId: session.id,
					created: session.created,
					expiresAt: session.expiresAt,
					csrfToken,
					cookieName: cookieName,
					user: {
						id: session.userId,
						email: session.userEmail,
						organizationId: session.organizationId,
						tenantId: session.tenantId
					}
				});
			} catch (error) {
				logger.error('Error creating session:', error);
				res.status(400).json({
					error: 'Session creation failed',
					message: error instanceof Error ? error.message : 'Unknown error'
				});
			}
		});

		// Delete session endpoint
		this.app.delete('/sse/session/:sessionId', sessionRateLimit, async (req, res) => {
			const sessionId = req.params.sessionId as string;

			try {
				// Require authenticated user
				const requesterUserId = req.userContext?.userId;
				if (!requesterUserId) {
					res.status(401).json({
						error: 'Unauthorized',
						message: 'Authentication required to delete session'
					});
					return;
				}

				// Validate the session to be deleted exists and get its details
				const validation = await sessionManager.validateSession(sessionId);
				if (!validation.valid || !validation.session) {
					res.status(404).json({
						error: 'Session not found',
						message: 'The specified session does not exist or is invalid'
					});
					return;
				}

				// Verify ownership: only the session owner can delete it
				if (validation.session.userId !== requesterUserId) {
					res.status(403).json({
						error: 'Forbidden',
						message: 'You can only delete your own sessions'
					});
					return;
				}

				// Delete the session
				if (sessionManager.destroySession(sessionId)) {
					// Clear session cookie if it exists
					const cookieName = this.transportConfig.session.cookieName;
					if (cookieName) {
						try {
							res.clearCookie(cookieName, {
								path: '/',
								httpOnly: true,
								secure: req.secure || process.env.NODE_ENV === 'production',
								sameSite: 'lax'
							});
						} catch (err) {
							logger.warn('Failed to clear session cookie:', err);
						}
					}
					logger.log(
						`Session deleted: ${sessionId} by user ${requesterUserId} from ${this.getClientIP(
							req,
							this.transportConfig.trustedProxies || []
						)}`
					);
					res.status(204).send();
				} else {
					res.status(404).json({ error: 'Session not found' });
				}
			} catch (error) {
				logger.error('Error deleting session:', error);
				res.status(500).json({
					error: 'Internal server error',
					message: 'Failed to delete session due to internal error'
				});
			}
		});

		// Get session info endpoint
		this.app.get(
			'/sse/session/:sessionId',
			sessionRateLimit,
			sessionMiddleware.createAuthorizationMiddleware(),
			async (req, res): Promise<void> => {
				const sessionId = req.params.sessionId as string;

				try {
					// Only allow accessing own session
					if (req.sessionId !== sessionId) {
						res.status(403).json({
							error: 'Forbidden',
							message: "Cannot access another user's session"
						});
						return;
					}
					const validation = await sessionManager.validateSession(
						sessionId,
						this.getClientIP(req),
						req.get('User-Agent')
					);

					if (!validation.valid || !validation.session) {
						res.status(404).json({
							error: 'Session not found or invalid',
							reason: validation.reason
						});
						return;
					}

					const connections = sessionManager.getSessionConnections(sessionId);

					res.json({
						session: {
							id: validation.session.id,
							userId: validation.session.userId,
							userEmail: validation.session.userEmail,
							organizationId: validation.session.organizationId,
							tenantId: validation.session.tenantId,
							created: validation.session.created,
							lastAccessed: validation.session.lastAccessed,
							lastActivity: validation.session.lastActivity,
							expiresAt: validation.session.expiresAt,
							isActive: validation.session.isActive,
							loginSource: validation.session.loginSource,
							connectionCount: connections.length
						},
						connections: connections.map((conn) => ({
							id: conn.id,
							type: conn.type,
							created: conn.created,
							lastSeen: conn.lastSeen,
							isActive: conn.isActive
						}))
					});
				} catch (error) {
					logger.error('Error getting session info:', error);
					res.status(500).json({
						error: 'Internal server error',
						message: 'Failed to retrieve session information'
					});
				}
			}
		);

		// Session stats endpoint
		this.app.get('/sse/sessions/stats', sessionRateLimit, (req, res) => {
			try {
				const stats = sessionManager.getStats();
				const metrics = sessionManager.getMetrics();

				res.json({
					stats,
					metrics: {
						sessionsCreated: metrics.sessionsCreated,
						sessionsDestroyed: metrics.sessionsDestroyed,
						connectionsCreated: metrics.connectionsCreated,
						connectionsDestroyed: metrics.connectionsDestroyed,
						cleanupRuns: metrics.cleanupRuns,
						lastCleanup: metrics.lastCleanup
					}
				});
			} catch (error) {
				logger.error('Error getting session stats:', error);
				res.status(500).json({
					error: 'Internal server error',
					message: 'Failed to retrieve session statistics'
				});
			}
		});
	}

	private async handleMcpRequest(req: AuthorizedRequest, res: express.Response) {
		const { jsonrpc, method, params, id } = req.body;

		// Validate JSON-RPC 2.0 format
		if (!method || jsonrpc !== '2.0' || (id !== null && typeof id !== 'string' && typeof id !== 'number')) {
			res.status(400).json({
				jsonrpc: '2.0',
				id: id ?? null,
				error: {
					code: -32600,
					message: 'Invalid Request'
				}
			});
			return;
		}

		try {
			// Add user context and authorization info to request metadata
			const userContext = req.userContext;
			const tokenInfo = req.tokenInfo;
			const enrichedParams =
				(userContext || tokenInfo) && params && !Array.isArray(params)
					? {
							...(params as Record<string, unknown>),
							_context: {
								// Session-based context (if available)
								...(userContext && {
									userId: userContext.userId,
									organizationId: userContext.organizationId,
									tenantId: userContext.tenantId,
									sessionId: userContext.sessionId,
									connectionId: req.connectionId
								}),
								// OAuth 2.0 context (if available)
								...(tokenInfo && {
									oauthSubject: tokenInfo.subject,
									oauthClientId: tokenInfo.clientId,
									oauthScopes: tokenInfo.scopes,
									authorized: tokenInfo.valid
								})
							}
					  }
					: params;

			// Create a mock transport interface for the MCP server
			const mockTransport: MockTransport = {
				start: async () => {},
				close: async () => {},
				send: (response: McpResponse) => {
					// Update session activity on response
					if (req.sessionId) {
						sessionManager.updateSessionActivity(req.sessionId, {
							lastMcpMethod: method,
							lastMcpId: id,
							lastMcpTimestamp: new Date().toISOString()
						});
					}

					// Send response back to HTTP client
					const isNotification = id === undefined || id === null;
					if (isNotification) {
						// spec: no content for notifications
						res.status(204).end();
					} else {
						res.json(response);
					}
				}
			};

			// Route the request to appropriate MCP server handler
			await this.routeMcpRequest(method, enrichedParams, id, mockTransport, userContext);
		} catch (error) {
			logger.error(`Error processing MCP method ${method}:`, error);
			res.status(500).json({
				jsonrpc: '2.0',
				id,
				error: {
					code: -32603,
					message: 'Internal error',
					data: error instanceof Error ? error.message : 'Unknown error'
				}
			});
		}
	}

	private handleMcpEventStream(req: express.Request, res: express.Response) {
		// Set SSE headers (CORS is handled by the global cors() middleware)
		res.writeHead(200, {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive',
			'X-Accel-Buffering': 'no'
		});

		// Send initial connection event
		res.write(
			`data: ${JSON.stringify({
				type: 'connected',
				timestamp: new Date().toISOString()
			})}\n\n`
		);

		// Keep connection alive
		const keepAlive = setInterval(() => {
			res.write(
				`data: ${JSON.stringify({
					type: 'ping',
					timestamp: new Date().toISOString()
				})}\n\n`
			);
			// Force flush to prevent proxy buffering
			(res as any).flush?.();
		}, 15000);

		// Clean up on client disconnect
		req.on('close', () => {
			clearInterval(keepAlive);
			res.end();
		});
	}

	private async routeMcpRequest(
		method: string,
		params: Record<string, unknown> | unknown[] | undefined,
		id: string | number | null | undefined,
		transport: MockTransport,
		userContext?: UserContext
	) {
		try {
			// Handle MCP protocol methods by delegating to the actual MCP server
			switch (method) {
				case 'initialize':
					transport.send({
						jsonrpc: '2.0',
						id,
						result: {
							protocolVersion: PROTOCOL_VERSION,
							capabilities: { tools: {} },
							serverInfo: {
								name: 'gauzy-mcp-server',
								version: '0.1.0'
							}
						}
					});
					break;

				case 'tools/list': {
					const tools = await this.getTools();
					logger.debug(`Tools list: ${JSON.stringify(tools)}`);
					transport.send({
						jsonrpc: '2.0',
						id,
						result: { tools }
					});
					break;
				}

				case 'tools/call': {
					const result = await this.callTool(params as Record<string, unknown>);
					transport.send({
						jsonrpc: '2.0',
						id,
						result
					});
					break;
				}

				default:
					transport.send({
						jsonrpc: '2.0',
						id,
						error: {
							code: -32601,
							message: `Method not found: ${method}`
						}
					});
			}
		} catch (error) {
			logger.error(`Error in routeMcpRequest for method ${method}:`, error);
			transport.send({
				jsonrpc: '2.0',
				id,
				error: {
					code: -32603,
					message: 'Internal error',
					data: error instanceof Error ? error.message : 'Unknown error'
				}
			});
		}
	}

	private async getTools(): Promise<ToolDescriptor[]> {
		try {
			const tools = await this.mcpServer.listTools();
			logger.debug(`Retrieved ${tools.length} tools from MCP server`);
			return tools;
		} catch (error) {
			logger.error('Error getting tools list:', error);
			return [];
		}
	}

	private async callTool(params: Record<string, unknown>): Promise<unknown> {
		try {
			const { name, arguments: args } = params;

			if (!name || typeof name !== 'string') {
				throw new Error('Tool name is required');
			}

			// Enhanced input validation
			const validation = validateMCPToolInput(name, args || {});
			if (!validation.valid) {
				SecurityLogger.logSecurityEvent(SecurityEvents.TOOL_VALIDATION_FAILED, 'medium', {
					tool: name,
					errors: validation.errors
				});
				throw new Error(`Invalid tool input: ${validation.errors.join(', ')}`);
			}

			if (name === 'login') {
				logger.debug(
					`Calling tool: ${name} with args keys:`,
					Object.keys((args as Record<string, unknown>) || {})
				);
			} else {
				logger.debug(`Calling tool: ${name} with args:`, validation.sanitized);
			}

			// Use the public method for tool invocation with sanitized args
			const result = await this.mcpServer.invokeTool(name, validation.sanitized);
			logger.debug(`Tool ${name} executed successfully`);

			return result;
		} catch (error) {
			logger.error('Error calling tool:', error);
			throw error;
		}
	}

	/**
	 * Normalize IP address by stripping IPv4-mapped IPv6 prefix
	 * Converts "::ffff:127.0.0.1" to "127.0.0.1"
	 * @param ip - The IP address to normalize
	 * @returns Normalized IP address
	 */
	private normalizeIP(ip: string): string {
		if (!ip) {
			return ip;
		}
		// Strip IPv4-mapped IPv6 prefix
		if (ip.startsWith('::ffff:')) {
			return ip.substring(7);
		}
		return ip;
	}

	private getClientIP(req: express.Request, trustedProxies: string[] = []): string {
		// If no trusted proxies configured, use socket address
		if (trustedProxies.length === 0) {
			return this.normalizeIP(req.socket.remoteAddress || 'unknown');
		}

		// Only trust headers if request comes from a trusted proxy
		const remoteAddress = this.normalizeIP(req.socket.remoteAddress || '');
		const normalizedProxies = trustedProxies.map((proxy) => this.normalizeIP(proxy));

		if (!normalizedProxies.includes(remoteAddress)) {
			return remoteAddress;
		}

		const forwarded = req.get('X-Forwarded-For');
		const realIP = req.get('X-Real-IP');

		if (forwarded) {
			return this.normalizeIP(forwarded.split(',')[0].trim());
		}

		if (realIP) {
			return this.normalizeIP(realIP.trim());
		}

		return this.normalizeIP(req.socket.remoteAddress || 'unknown');
	}

	async start(): Promise<void> {
		try {
			// Initialize session manager if sessions are enabled
			if (this.transportConfig.session.enabled && !this.isInitialized) {
				await sessionManager.initialize();
				this.isInitialized = true;
			}

			// Start HTTP server and wait for it to be listening
			await new Promise<void>((resolve, reject) => {
				this.httpServer = this.app.listen(this.transportConfig.port, this.transportConfig.host, () => {
					logger.log(
						`🚀 MCP HTTP Transport listening on http://${this.transportConfig.host}:${this.transportConfig.port}`
					);
					logger.log(`📡 Available endpoints:`);
					logger.log(`   - GET  /health - Health check`);

					if (this.authorizationConfig.enabled) {
						logger.log(`   - GET  /.well-known/oauth-protected-resource - OAuth 2.0 metadata`);
					}

					logger.log(
						`   - POST /sse - MCP protocol requests${
							this.authorizationConfig.enabled ? ' (protected)' : ''
						}`
					);
					logger.log(
						`   - GET  /sse/events - Server-sent events${
							this.authorizationConfig.enabled ? ' (protected)' : ''
						}`
					);

					if (this.authorizationConfig.enabled) {
						logger.log(`🔐 OAuth 2.0 Authorization:`);
						logger.log(`   - Resource URI: ${this.authorizationConfig.resourceUri}`);
						logger.log(
							`   - Required scopes: ${this.authorizationConfig.requiredScopes?.join(', ') || 'none'}`
						);
						logger.log(
							`   - Authorization servers: ${this.authorizationConfig.authorizationServers.length}`
						);
					}

					if (this.transportConfig.session.enabled) {
						logger.log(`   - POST /sse/session - Create session`);
						logger.log(`   - GET  /sse/session/:sessionId - Get session info`);
						logger.log(`   - DELETE /sse/session/:sessionId - Delete session`);
						logger.log(`   - GET  /sse/sessions/stats - Session statistics`);
						logger.log(`📡 Session management features:`);
						logger.log(`   - Multi-user session isolation`);
						logger.log(`   - Automatic session cleanup`);
						logger.log(`   - CSRF protection`);
						logger.log(`   - Rate limiting`);
					}

					resolve();
				});

				this.httpServer.on('error', (error) => {
					logger.error('HTTP server error:', error);
					reject(error);
				});
			});
		} catch (error) {
			throw error;
		}
	}

	async stop(): Promise<void> {
		return new Promise((resolve) => {
			// Shutdown session middleware if initialized
			if (this.isInitialized && this.transportConfig.session.enabled) {
				sessionMiddleware.shutdown();
			}

			if (this.httpServer) {
				this.httpServer.close(() => {
					logger.log('🛑 MCP HTTP Transport stopped');
					resolve();
				});
			} else {
				resolve();
			}
		});
	}

	getUrl(): string {
		return `http://${this.transportConfig.host}:${this.transportConfig.port}`;
	}
}
