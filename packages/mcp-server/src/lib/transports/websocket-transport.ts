import { Logger } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import WebSocket, { WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { McpTransportConfig } from '../common/config';
import { getAllTools, getToolCategory } from '../config/tools-registry';
import crypto from 'node:crypto';

const logger = new Logger('WebSocketTransport');

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
		features: {
			heartbeat: boolean;
			sessions: boolean;
			compression: boolean;
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

// WebSocket connection interface
interface WebSocketConnection {
	id: string;
	socket: WebSocket;
	isAlive: boolean;
	sessionId?: string;
	created: Date;
	lastSeen: Date;
}

export interface WebSocketTransportOptions {
	server: McpServer;
	transportConfig: McpTransportConfig['websocket'];
}

export class WebSocketTransport {
	private wss: WebSocketServer | null = null;
	private mcpServer: McpServer;
	private transportConfig: McpTransportConfig['websocket'];
	private connections = new Map<string, WebSocketConnection>();
	private sessions = new Map<string, { id: string; created: Date; lastAccessed: Date }>();
	private sessionTTL = 30 * 60 * 1000; // 30 minutes in milliseconds
	private heartbeatInterval: NodeJS.Timeout | null = null;
	private cleanupInterval: NodeJS.Timeout | null = null;
	private cachedTools: unknown[] | null = null;
	private cacheTimestamp: number = 0;
	private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

	constructor(options: WebSocketTransportOptions) {
		this.mcpServer = options.server;
		this.transportConfig = options.transportConfig;

		// Configure session TTL from environment or use default
		const ttl = Number.parseInt(process.env.MCP_SESSION_TTL ?? '1800000', 10);
		this.sessionTTL = Number.isFinite(ttl) ? ttl : 30 * 60 * 1000;
	}

	async start(): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
				// Create WebSocket server
				this.wss = new WebSocketServer({
					port: this.transportConfig.port,
					host: this.transportConfig.host,
					perMessageDeflate: this.transportConfig.compression,
					maxPayload: this.transportConfig.maxPayload || 16 * 1024 * 1024, // 16MB default
				});

				this.wss.on('connection', (ws, request) => {
					this.handleConnection(ws, request);
				});

				this.wss.on('error', (error) => {
					logger.error('WebSocket server error:', error);
					reject(error);
				});

				this.wss.on('listening', () => {
					logger.log(
						`🚀 MCP WebSocket Transport listening on ws://${this.transportConfig.host}:${this.transportConfig.port}`
					);
					logger.log(`📡 WebSocket server features:`);
					logger.log(`   - Real-time bidirectional communication`);
					logger.log(`   - Heartbeat/ping-pong mechanism`);
					logger.log(`   - Connection lifecycle management`);
					logger.log(`   - Auto-reconnection support`);

					if (this.transportConfig.session?.enabled) {
						logger.log(`   - Session management enabled`);
					}

					// Start heartbeat mechanism
					this.startHeartbeat();

					// Start session cleanup if sessions are enabled
					if (this.transportConfig.session?.enabled) {
						this.startSessionCleanup();
					}

					resolve();
				});

			} catch (error) {
				reject(error);
			}
		});
	}

	async stop(): Promise<void> {
		return new Promise((resolve) => {
			// Stop heartbeat and cleanup
			this.stopHeartbeat();
			this.stopSessionCleanup();

			// Close all connections
			this.connections.forEach((connection) => {
				if (connection.socket.readyState === WebSocket.OPEN) {
					connection.socket.close(1001, 'Server shutting down');
				}
			});
			this.connections.clear();
			this.sessions.clear();

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

	private handleConnection(ws: WebSocket, request: IncomingMessage): void {
		// Validate origin if configured
		if (this.transportConfig.allowedOrigins && Array.isArray(this.transportConfig.allowedOrigins)) {
				const origin = request.headers.origin;
				if (!origin || !this.transportConfig.allowedOrigins.includes(origin)) {
					logger.warn(`Rejected WebSocket connection from unauthorized origin: ${origin}`);
					ws.close(1008, 'Unauthorized origin');
					return;
				}
			}
		const connectionId = this.generateConnectionId();
		const connection: WebSocketConnection = {
			id: connectionId,
			socket: ws,
			isAlive: true,
			created: new Date(),
			lastSeen: new Date()
		};

		// Extract session ID from query parameters if sessions are enabled
		if (this.transportConfig.session?.enabled) {
			const host = request.headers.host;
			if (host) {
				const url = new URL(request.url || '', `ws://${host}`);
				const sessionId = url.searchParams.get('sessionId');
				if (sessionId && this.sessions.has(sessionId)) {
					connection.sessionId = sessionId;
					const session = this.sessions.get(sessionId)!;
					session.lastAccessed = new Date();
				}
			} else {
				logger.warn('Host header missing in WebSocket upgrade request - session extraction skipped');
			}
		}

		this.connections.set(connectionId, connection);

		logger.debug(`WebSocket connection established: ${connectionId} from ${request.socket.remoteAddress}`);

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
			this.connections.delete(connectionId);
		});

		// Set up error handling
		ws.on('error', (error) => {
			logger.error(`WebSocket connection error for ${connectionId}:`, error);
			this.connections.delete(connectionId);
		});

		// Send welcome message
		this.sendToConnection(connection, {
			jsonrpc: '2.0',
			method: 'transport/welcome',
			params: {
				connectionId,
				timestamp: new Date().toISOString(),
				features: {
					heartbeat: true,
					sessions: !!this.transportConfig.session?.enabled,
					compression: !!this.transportConfig.compression
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
			// Create a mock transport interface for the MCP server
			const mockTransport: McpTransport = {
				start: async () => {},
				close: async () => {},
				send: (response: McpResponse) => {
					this.sendToConnection(connection, response);
				}
			};

			// Route the request to appropriate MCP server handler
			await this.routeMcpRequest(method, params, id, mockTransport);

		} catch (error) {
			logger.error(`Error processing MCP method ${method} for ${connection.id}:`, error);
			this.sendError(connection, id, -32603, 'Internal error', error instanceof Error ? error.message : 'Unknown error');
		}
	}

	private async routeMcpRequest(method: string, params: Record<string, unknown> | unknown[] | undefined, id: string | number | null | undefined, transport: McpTransport) {
		try {
			// Handle basic MCP protocol methods
			switch (method) {
				case 'initialize':
					transport.send({
						jsonrpc: '2.0',
						id,
						result: {
							protocolVersion: '2025-06-18',
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
				/**
				 *  TODO: implementing the actual tools/call functionality once the tool execution system is ready
				 */
				case 'tools/call':
					{
						transport.send({
						jsonrpc: '2.0',
						id,
						error: { code: -32004, message: 'tools/call not implemented' }
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

	private async getTools(): Promise<unknown[]> {
		try {
			const now = Date.now();

			// Return cached tools if cache is still valid
			if (this.cachedTools && (now - this.cacheTimestamp) < this.CACHE_TTL) {
				logger.debug('Returning cached tools list');
				return this.cachedTools;
			}

			// Fetch and cache tools
			const tools = getAllTools();
			this.cachedTools = tools.map(toolName => {
				const category = getToolCategory(toolName);
				return {
					name: toolName,
					description: `${toolName} - Gauzy ${category || 'general'} tool`,
					inputSchema: {
						type: 'object',
						properties: {},
						additionalProperties: true
					}
				};
			});

			this.cacheTimestamp = now;
			logger.debug(`Cached ${this.cachedTools.length} tools from registry`);
			return this.cachedTools;
		} catch (error) {
			logger.error(`Failed to get tools: ${error instanceof Error ? error.message : 'Unknown error'}`);
			return [];
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
			this.connections.forEach((connection) => {
				if (!connection.isAlive) {
					logger.debug(`Terminating dead connection: ${connection.id}`);
					connection.socket.terminate();
					this.connections.delete(connection.id);
					return;
				}

				connection.isAlive = false;
				if (connection.socket.readyState === WebSocket.OPEN) {
					connection.socket.ping();
				}
			});
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

	private startSessionCleanup(): void {
		// Run cleanup every 5 minutes
		const cleanupIntervalMs = 5 * 60 * 1000;

		const timer = setInterval(() => {
			this.cleanupExpiredSessions();
		}, cleanupIntervalMs);
		timer.unref();
		this.cleanupInterval = timer;

		logger.debug(`Session cleanup started - TTL: ${this.sessionTTL}ms, Cleanup interval: ${cleanupIntervalMs}ms`);
	}

	private stopSessionCleanup(): void {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
			this.cleanupInterval = null;
			logger.debug('Session cleanup stopped');
		}
	}

	private cleanupExpiredSessions(): void {
		let expiredCount = 0;
		const sessionIds = Array.from(this.sessions.keys());

		for (const sessionId of sessionIds) {
			const session = this.sessions.get(sessionId);
			if (session && this.isSessionExpired(session)) {
				this.sessions.delete(sessionId);
				expiredCount++;

				// Also close connections using this session
				this.connections.forEach((connection) => {
					if (connection.sessionId === sessionId) {
						connection.socket.close(1000, 'Session expired');
						this.connections.delete(connection.id);
					}
				});
			}
		}

		if (expiredCount > 0) {
			logger.debug(`Cleaned up ${expiredCount} expired sessions. Active sessions: ${this.sessions.size}`);
		}
	}

	private isSessionExpired(session: { created: Date; lastAccessed: Date }): boolean {
		const now = new Date();
		const timeSinceLastAccess = now.getTime() - session.lastAccessed.getTime();
		return timeSinceLastAccess > this.sessionTTL;
	}

	private generateConnectionId(): string {
		const randomPart = crypto.randomBytes(16).toString('hex');
		return `ws_${Date.now()}_${randomPart}`;
	}

	private generateSessionId(): string {
		const randomPart = crypto.randomBytes(16).toString('hex');
		return `mcp_ws_${Date.now()}_${randomPart}`;
	}

	// Session management methods
	createSession(): { sessionId: string; created: Date; cookieName?: string } {
		if (!this.transportConfig.session?.enabled) {
			throw new Error('Sessions are not enabled for WebSocket transport');
		}

		const sessionId = this.generateSessionId();
		const session = {
			id: sessionId,
			created: new Date(),
			lastAccessed: new Date()
		};
		this.sessions.set(sessionId, session);

		logger.debug(`WebSocket session created: ${sessionId}`);

		return {
			sessionId,
			created: session.created,
			cookieName: this.transportConfig.session.cookieName
		};
	}

	deleteSession(sessionId: string): boolean {
		if (!this.transportConfig.session?.enabled) {
			return false;
		}

		const deleted = this.sessions.delete(sessionId);
		if (deleted) {
			logger.debug(`WebSocket session deleted: ${sessionId}`);

			// Close connections using this session
			this.connections.forEach((connection) => {
				if (connection.sessionId === sessionId) {
					connection.socket.close(1000, 'Session deleted');
					this.connections.delete(connection.id);
				}
			});
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
		return `${scheme}://${this.transportConfig.host}:${this.transportConfig.port}`;
	}

	getStats(): {
		connections: number;
		sessions: number;
		uptime: number;
	} {
		return {
			connections: this.connections.size,
			sessions: this.sessions.size,
			uptime: process.uptime()
		};
	}
}
