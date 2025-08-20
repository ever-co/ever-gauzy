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
import { getEnhancedSecurityHeaders, validateMCPToolInput, validateRequestSize } from '../common/security-config';
import { sanitizeErrorMessage } from '../common/security-utils';
import { SecurityLogger, SecurityEvents } from '../common/security-logger';

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
	private transportConfig: McpTransportConfig['http'];
	private isInitialized = false;

	constructor(options: HttpTransportOptions) {
		this.mcpServer = options.server;
		this.transportConfig = options.transportConfig;
		this.app = express();
		this.setupMiddleware();
		this.setupRoutes();
	}

	private setupMiddleware() {
		// CORS configuration
		this.app.use(cors({
			origin: this.transportConfig.cors.origin,
			credentials: this.transportConfig.cors.credentials,
			methods: ['GET', 'POST', 'OPTIONS', 'DELETE'],
			allowedHeaders: ['Content-Type', 'Authorization', 'mcp-session-id', 'mcp-csrf-token']
		}));

		// Enhanced security headers
		this.app.use((req, res, next) => {
			const securityHeaders = getEnhancedSecurityHeaders();
			for (const [header, value] of Object.entries(securityHeaders)) {
				res.setHeader(header, value);
			}
			next();
		});

		// JSON parsing with enhanced validation
		this.app.use(express.json({
			limit: process.env.NODE_ENV === 'production' ? '1mb' : '10mb',
			verify: (req, res, buf) => {
				const validation = validateRequestSize(buf, process.env.NODE_ENV === 'production' ? 1024 * 1024 : 10 * 1024 * 1024);
				if (!validation.valid) {
					if (validation.error === 'Request too large') {
						SecurityLogger.logSecurityEvent(SecurityEvents.LARGE_REQUEST, 'medium', {
							size: buf.length,
							ip: req.socket?.remoteAddress || 'unknown',
							error: validation.error
						});
					} else {
						SecurityLogger.logSecurityEvent(SecurityEvents.SUSPICIOUS_PAYLOAD, 'medium', {
							size: buf.length,
							ip: req.socket?.remoteAddress || 'unknown',
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
		}));

		// Cookie parsing for session management
		this.app.use(cookieParser());

		// URL-encoded body parsing (e.g., form submissions)
		this.app.use(express.urlencoded({ extended: true }));

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
			logger.debug(`${req.method} ${req.path} from ${this.getClientIP(req, this.transportConfig.trustedProxies || [])}`);
			next();
		});

		// Session management middleware (applied to protected routes)
		if (this.transportConfig.session.enabled) {
			this.setupSessionMiddleware();
		}
	}

	private setupSessionMiddleware() {
		// Create session middleware for protected MCP routes
		const mcpSessionMiddleware = sessionMiddleware.createSessionMiddleware({
			requireAuth: false, // MCP endpoints handle their own auth validation
			validateIP: false,
			validateUserAgent: false,
			enableCSRF: true,
			enableRateLimit: false,
			excludedPaths: ['/health', '/mcp/session*'],
			trustedProxies: this.transportConfig.trustedProxies || [],
		});

		// Rate limiting middleware
		const rateLimitMiddleware = sessionMiddleware.createRateLimitMiddleware({
			windowMs: 15 * 60 * 1000, // 15 minutes
			max: 100, // 100 requests per windowMs per session/IP
			trustedProxies: this.transportConfig.trustedProxies || [],
		});

		// Apply middleware to MCP routes
		this.app.use('/mcp', rateLimitMiddleware);
		this.app.use('/mcp', mcpSessionMiddleware);
	}

	private setupRoutes() {
		// Health check endpoint (no session required)
		this.app.get('/health', (req, res) => {
			const sessionStats = this.transportConfig.session.enabled
				? sessionManager.getStats()
				: null;

			res.json({
				status: 'healthy',
				timestamp: new Date().toISOString(),
				transport: 'http',
				server: 'gauzy-mcp-server',
				...(sessionStats && {
					sessions: {
						total: sessionStats.totalSessions,
						active: sessionStats.activeSessions,
						connections: sessionStats.totalConnections,
					}
				})
			});
		});

		// MCP Protocol endpoint - POST for requests
		this.app.post('/mcp', async (req, res) => {
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

		// Server-Sent Events endpoint for streaming
		this.app.get('/mcp/events', (req, res) => {
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
					const ip = req.ip || req.socket?.remoteAddress;
					return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
				}
				return false;
			}
		});

		// Create session endpoint
		this.app.post('/mcp/session', sessionRateLimit, async (req, res) => {
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
						origin: req.get('Origin'),
					},
				});

				// Generate CSRF token for the session
				const csrfToken = sessionMiddleware.generateCSRFToken(session.id);

				// Set session cookie if cookie name is configured
				const cookieName = this.transportConfig.session.cookieName;
				if (cookieName) {
					try {
						const maxAge = session.expiresAt ? new Date(session.expiresAt).getTime() - Date.now() : 24 * 60 * 60 * 1000; // 24 hours default
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

				logger.log(`Session created: ${session.id} for user ${session.userId} from ${req.ip}`);

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
						tenantId: session.tenantId,
					},
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
		this.app.delete('/mcp/session/:sessionId', sessionRateLimit, async (req, res) => {
			const sessionId = req.params.sessionId;

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
					logger.log(`Session deleted: ${sessionId} by user ${requesterUserId} from ${req.ip}`);
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
		this.app.get('/mcp/session/:sessionId', sessionRateLimit, sessionMiddleware.createAuthorizationMiddleware(), async (req, res): Promise<void> => {
			const sessionId = req.params.sessionId;

			try {
				// Only allow accessing own session
				if (req.sessionId !== sessionId) {
					res.status(403).json({
						error: 'Forbidden',
						message: 'Cannot access another user\'s session'
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
						reason: validation.reason,
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
						connectionCount: connections.length,
					},
					connections: connections.map(conn => ({
						id: conn.id,
						type: conn.type,
						created: conn.created,
						lastSeen: conn.lastSeen,
						isActive: conn.isActive,
					})),
				});
			} catch (error) {
				logger.error('Error getting session info:', error);
				res.status(500).json({
					error: 'Internal server error',
					message: 'Failed to retrieve session information'
				});
			}
		});

		// Session stats endpoint
		this.app.get('/mcp/sessions/stats', sessionRateLimit, (req, res) => {
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
						lastCleanup: metrics.lastCleanup,
					},
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

	private async handleMcpRequest(req: express.Request, res: express.Response) {
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
			// Add user context to request metadata if session is available
			const userContext = req.userContext;
			const enrichedParams =
				userContext && params && !Array.isArray(params)
				? {
					...(params as Record<string, unknown>),
					_context: {
						userId: userContext.userId,
						organizationId: userContext.organizationId,
						tenantId: userContext.tenantId,
						sessionId: userContext.sessionId,
						connectionId: req.connectionId,
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
							lastMcpTimestamp: new Date().toISOString(),
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
			'Connection': 'keep-alive',
			'X-Accel-Buffering': 'no'
		});

		// Send initial connection event
		res.write(`data: ${JSON.stringify({
			type: 'connected',
			timestamp: new Date().toISOString()
		})}\n\n`);

		// Keep connection alive
		const keepAlive = setInterval(() => {
			res.write(`data: ${JSON.stringify({
				type: 'ping',
				timestamp: new Date().toISOString()
			})}\n\n`);
			// Force flush to prevent proxy buffering
			(res as any).flush?.();
		}, 15000);

		// Clean up on client disconnect
		req.on('close', () => {
			clearInterval(keepAlive);
			res.end();
		});
	}

	private async routeMcpRequest(method: string, params: Record<string, unknown> | unknown[] | undefined, id: string | number | null | undefined, transport: MockTransport, userContext?: UserContext) {
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

				case 'tools/list':
					{
						const tools = await this.getTools();
						logger.debug(`Tools list: ${JSON.stringify(tools)}`);
						transport.send({
							jsonrpc: '2.0',
							id,
							result: { tools }
						});
						break;
					}

				case 'tools/call':
					{
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
                logger.debug(`Calling tool: ${name} with args keys:`, Object.keys((args as Record<string, unknown>) || {}));
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


	private getClientIP(req: express.Request, trustedProxies: string[] = []): string {
		// If no trusted proxies configured, use socket address
		if (trustedProxies.length === 0) {
			return req.socket.remoteAddress || 'unknown';
		}

		// Only trust headers if request comes from a trusted proxy
		const remoteAddress = req.socket.remoteAddress || '';
		if (!trustedProxies.includes(remoteAddress)) {
			return remoteAddress;
		}

		const forwarded = req.get('X-Forwarded-For');
		const realIP = req.get('X-Real-IP');

		if (forwarded) {
			return forwarded.split(',')[0].trim();
		}

		if (realIP) {
			return realIP.trim();
		}

		return req.socket.remoteAddress || 'unknown';
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
				this.httpServer = this.app.listen(
					this.transportConfig.port,
					this.transportConfig.host,
					() => {
						logger.log(
							`🚀 MCP HTTP Transport listening on http://${this.transportConfig.host}:${this.transportConfig.port}`
						);
						logger.log(`📡 Available endpoints:`);
						logger.log(`   - GET  /health - Health check`);
						logger.log(`   - POST /mcp - MCP protocol requests`);
						logger.log(`   - GET  /mcp/events - Server-sent events`);

						if (this.transportConfig.session.enabled) {
							logger.log(`   - POST /mcp/session - Create session`);
							logger.log(`   - GET  /mcp/session/:sessionId - Get session info`);
							logger.log(`   - DELETE /mcp/session/:id - Delete session`);
							logger.log(`   - GET  /mcp/sessions/stats - Session statistics`);
							// NOTE: Leave DELETE log aligned or update it too for consistency:
          					logger.log(`   - DELETE /mcp/session/:sessionId - Delete session`);
							logger.log(`📡 Session management features:`);
							logger.log(`   - Multi-user session isolation`);
							logger.log(`   - Automatic session cleanup`);
							logger.log(`   - CSRF protection`);
							logger.log(`   - Rate limiting`);
						}

						resolve();
					}
				);

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
