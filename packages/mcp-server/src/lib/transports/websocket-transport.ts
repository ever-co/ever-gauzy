import { Logger } from '@nestjs/common';
import WebSocket, { WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { McpTransportConfig } from '../common/config';
import crypto from 'node:crypto';
import { sessionManager, sessionMiddleware, UserContext } from '../session';
import { PROTOCOL_VERSION } from '../config';
import https from 'node:https';
import { ExtendedMcpServer, ToolDescriptor } from '../mcp-server';
import { getEnhancedTLSOptions, validateMCPToolInput, validateRequestSize } from '../common/security-config';
import { SecurityLogger, SecurityEvents } from '../common/security-logger';

const logger = new Logger('WebSocketTransport');

// In-memory rate limiter
interface RateLimitEntry { count: number; resetAt: number; }
const rateLimiter = new Map<string, RateLimitEntry>();
const MAX_RATE_LIMIT_ENTRIES = 10000;
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_ATTEMPTS = 20;

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

// WebSocket message types
interface WebSocketPingMessage {
	type: 'ping';
}

interface WebSocketPongMessage {
	type: 'pong';
	timestamp: string;
}

interface WebSocketWelcomeMessage {
	jsonrpc: '2.0';
	method: 'transport/welcome';
	params: {
		connectionId: string;
		timestamp: string;
		sessionId?: string;
		features: {
			heartbeat: boolean;
			sessions: boolean;
			compression: boolean;
			userContext: boolean;
		};
	};
}

type WebSocketMessage = JsonRpcRequest | JsonRpcResponse | JsonRpcErrorResponse | WebSocketPingMessage | WebSocketPongMessage | WebSocketWelcomeMessage;

// MCP Transport interface
interface McpTransport {
	start(): Promise<void>;
	close(): Promise<void>;
	send(response: JsonRpcResponse | JsonRpcErrorResponse): void;
}

// WebSocket session middleware interface
interface WebSocketSessionMiddleware {
	(
		sessionId: string,
		connectionId: string,
		context: {
			ipAddress?: string;
			userAgent?: string;
			origin?: string;
		}
	): Promise<{
		valid: boolean;
		reason?: string;
		userContext?: UserContext;
	}>;
}

// WebSocket connection interface
interface WebSocketConnection {
	id: string;
	socket: WebSocket;
	isAlive: boolean;
	sessionId?: string;
	userContext?: UserContext;
	created: Date;
	lastSeen: Date;
	metadata: Record<string, any>;
}

export interface WebSocketTransportOptions {
	server: ExtendedMcpServer;
	transportConfig: McpTransportConfig['websocket'];
}

export class WebSocketTransport {
	private wss: WebSocketServer | null = null;
	private readonly mcpServer: ExtendedMcpServer;
	private transportConfig: McpTransportConfig['websocket'];
	private connections = new Map<string, WebSocketConnection>();
	private heartbeatInterval: NodeJS.Timeout | null = null;
	private cachedTools: ToolDescriptor[] | null = null;
	private cacheTimestamp: number = 0;
	private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
	private sessionMiddlewareInstance: WebSocketSessionMiddleware | null = null;
	private isInitialized = false;

	constructor(options: WebSocketTransportOptions) {
		this.mcpServer = options.server;
		this.transportConfig = options.transportConfig;
	}

	async start(): Promise<void> {
		try {
			// Initialize session manager if sessions are enabled
			if (this.transportConfig.session?.enabled && !this.isInitialized) {
				await sessionManager.initialize();
				this.sessionMiddlewareInstance = sessionMiddleware.createWebSocketSessionMiddleware({
					requireAuth: false, // WebSocket handles its own auth validation
					validateIP: false,
					validateUserAgent: false,
				});
				this.isInitialized = true;
			}

			// Create WebSocket server (supports TLS, path, and proper compression flags)
			let httpsServer: import('node:https').Server | undefined;
			const perMessageDeflate =
				!!(this.transportConfig.compression && (this.transportConfig.perMessageDeflate ?? true));

			if (this.transportConfig.tls) {
				if (!this.transportConfig.cert || !this.transportConfig.key) {
					throw new Error('TLS enabled but cert/key not provided in websocket config');
				}
				// Use enhanced TLS configuration for production security
				const tlsOptions = getEnhancedTLSOptions(this.transportConfig.cert, this.transportConfig.key);
				if (!tlsOptions) {
					throw new Error('TLS enabled but cert/key not provided in websocket config');
				}
				httpsServer = https.createServer(tlsOptions);
				httpsServer.listen(this.transportConfig.port, this.transportConfig.host);
				this.wss = new WebSocketServer({
					server: httpsServer,
					perMessageDeflate,
					maxPayload: this.transportConfig.maxPayload || 1024 * 1024, // 1MB for security
					path: this.transportConfig.path,
					verifyClient: (info) => this.verifyClient(info),
				});
			} else {
				this.wss = new WebSocketServer({
					port: this.transportConfig.port,
					host: this.transportConfig.host,
					perMessageDeflate,
					maxPayload: this.transportConfig.maxPayload || 1024 * 1024, // 1MB for security
					path: this.transportConfig.path,
					verifyClient: (info) => this.verifyClient(info),
				});
			}

			// Wait for server to be ready
			await new Promise<void>((resolve, reject) => {
				const listeningTarget = this.transportConfig.tls ? httpsServer! : this.wss!;
				listeningTarget.on('error', (error: unknown) => {
					logger.error('WebSocket server error:', error);
					reject(error);
				});

				listeningTarget.on('listening', () => {
					logger.log(
						`🚀 MCP WebSocket Transport listening on ws://${this.transportConfig.host}:${this.transportConfig.port}`
					);
					logger.log(`📡 WebSocket server features:`);
					logger.log(`   - Real-time bidirectional communication`);
					logger.log(`   - Heartbeat/ping-pong mechanism`);
					logger.log(`   - Connection lifecycle management`);
					logger.log(`   - Auto-reconnection support`);

					if (this.transportConfig.session?.enabled) {
						logger.log(`📡 Session management features:`);
						logger.log(`   - Multi-user session isolation`);
						logger.log(`   - Automatic session cleanup`);
						logger.log(`   - Connection-session binding`);
						logger.log(`   - Session activity tracking`);
					}

					// Start heartbeat mechanism
					this.startHeartbeat();

					resolve();
				});
			});

			// Set up connection handling after server is ready
			this.wss.on('connection', (ws, request) => {
				this.handleConnection(ws, request);
			});

		} catch (error) {
			throw error;
		}
	}

	async stop(): Promise<void> {
		return new Promise((resolve) => {
			// Stop heartbeat
			this.stopHeartbeat();

			// Close all connections
			this.connections.forEach((connection) => {
				// Remove connection from session manager if it exists
				if (connection.sessionId) {
					sessionManager.removeConnection(connection.id);
				}
				if (connection.socket.readyState === WebSocket.OPEN) {
					connection.socket.close(1001, 'Server shutting down');
				}
			});
			this.connections.clear();

			if (this.wss) {
				this.wss.close(() => {
					logger.log('🛑 MCP WebSocket Transport stopped');
					resolve();
				});
			} else {
				resolve();
			}
		});
	}

	private async handleConnection(ws: WebSocket, request: IncomingMessage): Promise<void> {
		// Validate origin if configured
		if (this.transportConfig.allowedOrigins !== undefined) {
			const origin = request.headers.origin;
			// Check for wildcard first
			if (this.transportConfig.allowedOrigins.includes('*')) {
				// Allow all origins when * is present
				logger.warn(`Allowing ALL WebSocket origins (wildcard '*'). Do not use in production.`);
				logger.debug(`Connection origin: ${origin || 'undefined'}`);
			} else if (!origin || !this.transportConfig.allowedOrigins.includes(origin)) {
				logger.warn(`Rejected WebSocket connection from unauthorized origin: ${origin}`);
				ws.close(1008, 'Unauthorized origin');
				return;
			}
		}

		const connectionId = this.generateConnectionId();
		const clientIP = this.getClientIP(request, this.transportConfig.trustedProxies || []);
		const userAgent = request.headers['user-agent'];

		const connection: WebSocketConnection = {
			id: connectionId,
			socket: ws,
			isAlive: true,
			created: new Date(),
			lastSeen: new Date(),
			metadata: {
				origin: request.headers.origin,
				userAgent,
				remoteAddress: clientIP,
				url: request.url,
			}
		};

		// Handle session validation if sessions are enabled
		if (this.transportConfig.session?.enabled && this.sessionMiddlewareInstance) {
			const sessionId = this.extractSessionIdFromRequest(request);

			if (sessionId) {
				try {
					const validation = await this.sessionMiddlewareInstance(
						sessionId,
						connectionId,
						{
							ipAddress: clientIP,
							userAgent,
							origin: request.headers.origin,
						}
					);

					if (validation.valid) {
						connection.sessionId = sessionId;
						connection.userContext = validation.userContext;
						logger.debug(`WebSocket connection ${connectionId} associated with session ${sessionId}`);
					} else {
						logger.warn(`WebSocket connection rejected: ${validation.reason}`);
						ws.close(1008, `Session validation failed: ${validation.reason}`);
						return;
					}
				} catch (error) {
					logger.error(`Session validation error for connection ${connectionId}:`, error);
					ws.close(1011, 'Session validation error');
					return;
				}
			}
		}

		this.connections.set(connectionId, connection);

		logger.debug(`WebSocket connection established: ${connectionId} from ${clientIP}`);

		// Set up message handling
		ws.on('message', async (data) => {
			await this.handleMessage(connection, data);
		});

		// Set up pong handling for heartbeat
		ws.on('pong', () => {
			connection.isAlive = true;
			connection.lastSeen = new Date();
		});

		// Set up connection close handling
		ws.on('close', (code, reason) => {
			logger.debug(`WebSocket connection closed: ${connectionId} (code: ${code}, reason: ${reason})`);
			// Remove connection from session manager
			if (connection.sessionId) {
				sessionManager.removeConnection(connectionId);
			}
			this.connections.delete(connectionId);
		});

		// Set up error handling
		ws.on('error', (error) => {
			logger.error(`WebSocket connection error for ${connectionId}:`, error);
			// Remove connection from session manager
			if (connection.sessionId) {
				sessionManager.removeConnection(connectionId);
			}
			this.connections.delete(connectionId);
		});

		// Send welcome message
		this.sendToConnection(connection, {
			jsonrpc: '2.0',
			method: 'transport/welcome',
			params: {
				connectionId,
				timestamp: new Date().toISOString(),
				sessionId: connection.sessionId,
				features: {
					heartbeat: true,
					sessions: !!this.transportConfig.session?.enabled,
					compression: !!(this.transportConfig.compression && this.transportConfig.perMessageDeflate),
					userContext: !!connection.userContext
				}
			}
		});
	}

	private async handleMessage(connection: WebSocketConnection, data: WebSocket.RawData): Promise<void> {
		try {
			// Normalize incoming data to string
			let messageString: string;
			if (Buffer.isBuffer(data)) {
				messageString = data.toString('utf8');
			} else if (Array.isArray(data)) {
				// Handle Buffer[] by concatenating
				messageString = Buffer.concat(data).toString('utf8');
			} else if (data instanceof ArrayBuffer) {
				messageString = Buffer.from(data).toString('utf8');
			} else {
				// Assume string
				messageString = String(data);
			}

			const message = JSON.parse(messageString);
			connection.lastSeen = new Date();

			// Handle special WebSocket messages
			if (message.type === 'ping') {
				this.sendToConnection(connection, { type: 'pong', timestamp: new Date().toISOString() });
				return;
			}

			// Handle MCP JSON-RPC messages
			if (message.jsonrpc === '2.0') {
				await this.handleMcpMessage(connection, message);
			} else {
				logger.warn(`Received invalid message format from ${connection.id}`);
				this.sendError(connection, null, -32600, 'Invalid Request');
			}

		} catch (error) {
			logger.error(`Error parsing message from ${connection.id}:`, error);
			this.sendError(connection, null, -32700, 'Parse error');
		}
	}

	private async handleMcpMessage(connection: WebSocketConnection, message: JsonRpcRequest): Promise<void> {
		const { jsonrpc, method, params, id } = message;

		// Validate JSON-RPC 2.0 format
		if (!method || jsonrpc !== '2.0' || (id !== null && typeof id !== 'string' && typeof id !== 'number')) {
			this.sendError(connection, id, -32600, 'Invalid Request');
			return;
		}

		try {
			// Add user context to request metadata if session is available
			const userContext = connection.userContext;
			const enrichedParams =
				userContext && params && !Array.isArray(params)
				? {
					...(params as Record<string, unknown>),
					_context: {
						userId: userContext.userId,
						organizationId: userContext.organizationId,
						tenantId: userContext.tenantId,
						sessionId: userContext.sessionId,
						connectionId: connection.id,
					}
					}
				: params;

			// Create a mock transport interface for the MCP server
			const mockTransport: McpTransport = {
				start: async () => {},
				close: async () => {},
				send: (response: McpResponse) => {
					// Update session activity on response
					if (connection.sessionId) {
						sessionManager.updateSessionActivity(connection.sessionId, {
							lastMcpMethod: method,
							lastMcpId: id,
							lastMcpTimestamp: new Date().toISOString(),
							connectionType: 'websocket',
						});
					}
					this.sendToConnection(connection, response);
				}
			};

			// Route the request to appropriate MCP server handler
			await this.routeMcpRequest(method, enrichedParams, id, mockTransport, userContext);

		} catch (error) {
			logger.error(`Error processing MCP method ${method} for ${connection.id}:`, error);
			this.sendError(connection, id, -32603, 'Internal error', error instanceof Error ? error.message : 'Unknown error');
		}
	}

	private async routeMcpRequest(method: string, params: Record<string, unknown> | unknown[] | undefined, id: string | number | null | undefined, transport: McpTransport, userContext?: UserContext) {
		try {
			// Handle basic MCP protocol methods
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
			const now = Date.now();

			// Return cached tools if cache is still valid
			if (this.cachedTools && (now - this.cacheTimestamp) < this.CACHE_TTL) {
				logger.debug('Returning cached tools list');
				return this.cachedTools;
			}

			// Use the public method to get tools from MCP server
			this.cachedTools = await this.mcpServer.listTools();
			this.cacheTimestamp = now;
			logger.debug(`Cached ${this.cachedTools.length} tools from MCP server`);
			return this.cachedTools;
		} catch (error) {
			logger.error(`Failed to get tools: ${error instanceof Error ? error.message : 'Unknown error'}`);
			return [];
		}
	}

	private async callTool(params: Record<string, unknown>): Promise<unknown> {
		try {
			const { name, arguments: args } = params;

			if (!name || typeof name !== 'string') {
				throw new Error('Tool name is required');
			}

			// Validate and sanitize tool input
			const { valid, errors, sanitized } = validateMCPToolInput(String(name), (args as Record<string, unknown>) || {});
			if (!valid) {
				throw new Error(`Tool input validation failed: ${errors.join(', ')}`);
			}

			// Never log sensitive args; for login show only argument keys
			const safeArgsForLog =
				name === 'login'
					? { keys: Object.keys((args as Record<string, unknown>) || {}) }
					: sanitized;
			logger.debug(`Calling tool: ${name} with args:`, safeArgsForLog);

			// Use the public method for tool invocation
			const result = await this.mcpServer.invokeTool(name, sanitized as Record<string, unknown>);
			logger.debug(`Tool ${name} executed successfully`);

			return result;

		} catch (error) {
			logger.error('Error calling tool:', error);
			throw error;
		}
	}

	private sendToConnection(connection: WebSocketConnection, message: WebSocketMessage): void {
		if (connection.socket.readyState === WebSocket.OPEN) {
			try {
				const payload = JSON.stringify(message);
				// Drop or log when buffering too much (5MB threshold example)
				if (connection.socket.bufferedAmount > 5 * 1024 * 1024) {
					logger.warn(`Backpressure: dropping message to ${connection.id} (buffered=${connection.socket.bufferedAmount})`);
					return;
				}
				connection.socket.send(payload);
			} catch (error) {
				logger.error(`Error sending message to connection ${connection.id}:`, error);
			}
		}
	}

	private sendError(connection: WebSocketConnection, id: string | number | null | undefined, code: number, message: string, data?: unknown): void {
		this.sendToConnection(connection, {
			jsonrpc: '2.0',
			id: id ?? null,
			error: { code, message, ...(data && { data }) }
		});
	}

	private startHeartbeat(): void {
		// Send ping every 30 seconds
		this.heartbeatInterval = setInterval(() => {
			const deadConnections: string[] = [];
			this.connections.forEach((connection) => {
				if (!connection.isAlive) {
					logger.debug(`Terminating dead connection: ${connection.id}`);
					connection.socket.terminate();
					deadConnections.push(connection.id);
					return;
				}

				connection.isAlive = false;
				if (connection.socket.readyState === WebSocket.OPEN) {
					connection.socket.ping();
				}
			});
			// Delete dead connections after iteration
        	deadConnections.forEach(id => this.connections.delete(id));
		}, 30000);
		this.heartbeatInterval.unref?.();

		logger.debug('WebSocket heartbeat mechanism started');
	}

	private stopHeartbeat(): void {
		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval);
			this.heartbeatInterval = null;
			logger.debug('WebSocket heartbeat mechanism stopped');
		}
	}


	private generateConnectionId(): string {
		const randomPart = crypto.randomBytes(16).toString('hex');
		return `ws_${Date.now()}_${randomPart}`;
	}

	private extractSessionIdFromRequest(request: IncomingMessage): string | null {
		const host = request.headers.host;
		if (!host) {
			logger.warn('Host header missing in WebSocket upgrade request - session extraction skipped');
			return null;
		}

		try {
			// Sanitize host to prevent URL parsing issues
			const sanitizedHost = host.replace(/[^a-zA-Z0-9\-.:[\]]/g, '');
			const baseUrl = `ws://${sanitizedHost}`;
			const url = new URL(request.url || '/', baseUrl);
			return url.searchParams.get('sessionId') || null;
		} catch (error) {
			logger.warn(`Failed to parse WebSocket URL for session extraction (host: ${host}, url: ${request.url}):`, error);
			return null;
		}
	}

	private getClientIP(request: IncomingMessage, trustedProxies: string[] = []): string {
		// If no trusted proxies configured, use socket address
		if (trustedProxies.length === 0) {
			return request.socket.remoteAddress || 'unknown';
		}

		// Only trust headers if request comes from a trusted proxy
		const remoteAddress = request.socket.remoteAddress || '';
		if (!trustedProxies.includes(remoteAddress)) {
			return remoteAddress;
		}

		const forwarded = request.headers['x-forwarded-for'];
		const realIP = request.headers['x-real-ip'];

		if (forwarded) {
			const forwardedIPs = Array.isArray(forwarded) ? forwarded : [forwarded];
			return forwardedIPs[0].split(',')[0].trim();
		}

		if (realIP) {
			const realIPs = Array.isArray(realIP) ? realIP : [realIP];
			return realIPs[0].trim();
		}

		return request.socket.remoteAddress || 'unknown';
	}

	// Session management methods (now delegated to centralized session manager)
	async createSession(options: {
		userId?: string;
		userEmail?: string;
		organizationId?: string;
		tenantId?: string;
		metadata?: Record<string, any>;
		autoAuthenticate?: boolean;
	} = {}): Promise<{ sessionId: string; created: Date; cookieName?: string }> {
		if (!this.transportConfig.session?.enabled) {
			throw new Error('Sessions are not enabled for WebSocket transport');
		}

		const session = await sessionManager.createSession({
			...options,
			loginSource: 'websocket',
		});

		logger.debug(`WebSocket session created: ${session.id}`);

		return {
			sessionId: session.id,
			created: session.created,
			cookieName: this.transportConfig.session.cookieName
		};
	}

	deleteSession(sessionId: string): boolean {
		if (!this.transportConfig.session?.enabled) {
			return false;
		}

		// First, close and remove all connections for this session
		const connectionsToClose: string[] = [];
		this.connections.forEach((connection, connectionId) => {
			if (connection.sessionId === sessionId) {
				connectionsToClose.push(connectionId);
			}
		});

		// Remove connections from session manager before destroying session
		connectionsToClose.forEach(connectionId => {
			sessionManager.removeConnection(connectionId);
			const connection = this.connections.get(connectionId);
			if (connection) {
				connection.socket.close(1000, 'Session deleted');
				this.connections.delete(connectionId);
			}
		});

		const deleted = sessionManager.destroySession(sessionId);
		if (deleted) {
			logger.debug(`WebSocket session deleted: ${sessionId}`);
		}

		return deleted;
	}

	// Broadcast message to all connections
	broadcast(message: WebSocketMessage): void {
		this.connections.forEach((connection) => {
			this.sendToConnection(connection, message);
		});
	}

	// Send message to specific session
	sendToSession(sessionId: string, message: WebSocketMessage): boolean {
		const connectionsInSession = Array.from(this.connections.values())
			.filter(connection => connection.sessionId === sessionId);

		if (connectionsInSession.length === 0) {
			return false;
		}

		connectionsInSession.forEach((connection) => {
			this.sendToConnection(connection, message);
		});

		return true;
	}

	getUrl(): string {
		const scheme = this.transportConfig.tls ? 'wss' : 'ws';
		const path = this.transportConfig.path ? this.transportConfig.path.replace(/^\/*/, '/') : '';
		return `${scheme}://${this.transportConfig.host}:${this.transportConfig.port}${path}`;
	}

	getStats(): {
		connections: number;
		sessions?: number;
		uptime: number;
	} {
		const stats: {
			connections: number;
			sessions?: number;
			uptime: number;
		} = {
			connections: this.connections.size,
			uptime: process.uptime()
		};

		// Add session stats if session management is enabled
		if (this.transportConfig.session?.enabled) {
			const sessionStats = sessionManager.getStats();
			stats.sessions = sessionStats.totalSessions;
		}

		return stats;
	}

	/**
	 * Enhanced client verification for security
	 */
	private verifyClient(info: { req: IncomingMessage; origin: string; secure: boolean }): boolean {
		const req = info.req;
		const origin = info.origin;
		const ip = this.getClientIP(req, this.transportConfig.trustedProxies || []);

		// Lightweight in-memory rate limiting by IP
		const now = Date.now();
		let entry = rateLimiter.get(ip);

		if (!entry || now >= entry.resetAt) {
			entry = { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
		} else {
			entry.count++;
		}

		rateLimiter.set(ip, entry);

		if (entry.count > RATE_LIMIT_MAX_ATTEMPTS) {
			SecurityLogger.logSecurityEvent(SecurityEvents.RATE_LIMIT_EXCEEDED, 'medium', { ip, origin, count: entry.count });
			return false;
		}

		// Cleanup map if too large
		if (rateLimiter.size > MAX_RATE_LIMIT_ENTRIES) {
			const expiredIps: string[] = [];
			for (const [cleanupIp, cleanupEntry] of rateLimiter) {
				if (now >= cleanupEntry.resetAt) expiredIps.push(cleanupIp);
			}
			expiredIps.forEach(expiredIp => rateLimiter.delete(expiredIp));
		}

		// Origin validation in production
		if (process.env.NODE_ENV === 'production') {
			const allowedOrigins = this.transportConfig.allowedOrigins || [];
			if (allowedOrigins.length > 0) {
				if (allowedOrigins.includes('*')) {
					logger.warn(`Allowing ALL WebSocket origins in production due to wildcard '*'`);
				} else if (!allowedOrigins.includes(origin)) {
					SecurityLogger.logSecurityEvent(SecurityEvents.UNAUTHORIZED_ORIGIN, 'medium', { ip, origin });
					return false;
				}
			}
		}

		// User agent validation (production only)
		const userAgent = req.headers['user-agent'];
		if (process.env.NODE_ENV === 'production' && userAgent && /bot|crawler|spider|scraper/i.test(userAgent)) {
			SecurityLogger.logSecurityEvent(SecurityEvents.SUSPICIOUS_USER_AGENT, 'low', { ip, userAgent });
			return false;
		}

		return true;
	}

	/**
	 * Enhanced message validation with security checks
	 */
	private validateMessage(data: Buffer, connection: WebSocketConnection): { valid: boolean; error?: string } {
		// Size validation
		const sizeValidation = validateRequestSize(data, 1024 * 1024); // 1MB limit
		if (!sizeValidation.valid) {
			SecurityLogger.logSecurityEvent(SecurityEvents.LARGE_REQUEST, 'medium', {
				size: data.length,
				connectionId: connection.id
			});
			return sizeValidation;
		}

		try {
			const message = JSON.parse(data.toString());

			// Basic structure validation
			if (!message.jsonrpc || message.jsonrpc !== '2.0') {
				return { valid: false, error: 'Invalid JSON-RPC format' };
			}

			// Method validation for tool calls
			if (message.method === 'tools/call') {
				const validation = validateMCPToolInput(message.params?.name || '', message.params?.arguments || {});
				if (!validation.valid) {
					SecurityLogger.logSecurityEvent(SecurityEvents.TOOL_VALIDATION_FAILED, 'medium', {
						tool: message.params?.name,
						errors: validation.errors,
						connectionId: connection.id
					});
					return { valid: false, error: validation.errors.join(', ') };
				}
			}

			return { valid: true };
		} catch (error) {
			return { valid: false, error: 'Invalid JSON format' };
		}
	}
}
