import { Logger } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import express from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { Server } from 'node:http';
import { McpTransportConfig } from '../common/config';
import crypto from 'node:crypto';

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
interface MockTransport extends McpTransport {
	start(): Promise<void>;
	close(): Promise<void>;
	send(response: McpResponse): void;
}

export interface HttpTransportOptions {
	server: McpServer;
	transportConfig: McpTransportConfig['http'];
}

export class HttpTransport {
	private app: express.Application;
	private httpServer: Server | null = null;
	private mcpServer: McpServer;
	private transportConfig: McpTransportConfig['http'];
	private sessions = new Map<string, { id: string; created: Date; lastAccessed: Date }>();
	private sessionTTL = 30 * 60 * 1000; // 30 minutes in milliseconds
	private cleanupInterval: NodeJS.Timeout | null = null;

	constructor(options: HttpTransportOptions) {
		this.mcpServer = options.server;
		this.transportConfig = options.transportConfig;
		this.app = express();
		this.setupMiddleware();
		this.setupRoutes();

		// Configure session TTL from environment or use default
		const ttl = Number.parseInt(process.env.MCP_SESSION_TTL ?? '1800000', 10);
		this.sessionTTL = Number.isFinite(ttl) ? ttl : 1_800_000;

		// Start session cleanup if sessions are enabled
		if (this.transportConfig.session.enabled) {
			this.startSessionCleanup();
		}
	}

	private setupMiddleware() {
		// CORS configuration
		this.app.use(cors({
			origin: this.transportConfig.cors.origin,
			credentials: this.transportConfig.cors.credentials,
			methods: ['GET', 'POST', 'OPTIONS'],
			allowedHeaders: ['Content-Type', 'Authorization', 'Mcp-Session-Id']
		}));

		// JSON parsing
		this.app.use(express.json({ limit: '10mb' }));

		// Request logging
		this.app.use((req, res, next) => {
			logger.debug(`${req.method} ${req.path} from ${req.ip}`);
			next();
		});

		// Session management
		if (this.transportConfig.session.enabled) {
			this.app.use((req, res, next) => {
				const sessionId = req.headers['mcp-session-id'] as string;
				if (sessionId) {
					const session = this.sessions.get(sessionId);
					if (session) {
						// Check if session is still valid
						if (this.isSessionExpired(session)) {
							this.sessions.delete(sessionId);
							logger.debug(`Session ${sessionId} expired and removed`);
						} else {
							session.lastAccessed = new Date();
							req.sessionId = sessionId;
						}
					}
				}
				next();
			});
		}
	}

	private setupRoutes() {
		// Health check endpoint
		this.app.get('/health', (req, res) => {
			const sessionStats = this.transportConfig.session.enabled ? {
				activeSessions: this.sessions.size,
				sessionTTL: this.sessionTTL
			} : null;

			res.json({
				status: 'healthy',
				timestamp: new Date().toISOString(),
				transport: 'http',
				server: 'gauzy-mcp-server',
				...(sessionStats && { sessions: sessionStats })
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

		// Session management endpoints with rate limiting
		if (this.transportConfig.session.enabled) {
			// Rate limiting for session endpoints
			const maxRequests = (() => {
				const v = Number.parseInt(process.env.MCP_SESSION_RATE_LIMIT ?? '', 10);
				return Number.isInteger(v) && v > 0 ? v : 50;
			})();
			const sessionRateLimit = rateLimit({
				windowMs: 15 * 60 * 1000, // 15 minutes
				max: maxRequests, // Limit each IP per window
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

			this.app.post('/mcp/session', sessionRateLimit, (req, res) => {
				const sessionId = this.generateSessionId();
				const session = {
					id: sessionId,
					created: new Date(),
					lastAccessed: new Date()
				};
				this.sessions.set(sessionId, session);

				logger.debug(`Session created: ${sessionId} from ${req.ip}`);

				res.json({
					sessionId,
					created: session.created,
					cookieName: this.transportConfig.session.cookieName
				});
			});

			this.app.delete('/mcp/session/:sessionId', sessionRateLimit, (req, res) => {
				const sessionId = req.params.sessionId;
				if (this.sessions.delete(sessionId)) {
					logger.debug(`Session deleted: ${sessionId} from ${req.ip}`);
					res.status(204).send(); // 204 No Content for successful deletion
				} else {
					res.status(404).json({ error: 'Session not found' });
				}
			});
		}
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
			// Create a mock transport interface for the MCP server
			const mockTransport: MockTransport = {
				start: async () => {},
				close: async () => {},
				send: (response: McpResponse) => {
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
			await this.routeMcpRequest(method, params, id, mockTransport);

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

	private async routeMcpRequest(method: string, params: Record<string, unknown> | unknown[] | undefined, id: string | number | null | undefined, transport: MockTransport) {
		try {

			// Convert the HTTP request into a format the MCP server can handle
			// This is a placeholder - the actual implementation would need to
			// properly integrate with the MCP server's request handling

			// For now, handle basic MCP protocol methods
			switch (method) {
				case 'initialize':
					transport.send({
						jsonrpc: '2.0',
						id,
						result: {
							protocolVersion: '2025-03-26',
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
					// This would need to integrate with your tool execution system
					throw new Error('Tool execution requires proper MCP server integration');

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
		// This would integrate with your existing tools registry
		// For now, return empty array - you'll need to implement tool listing
		return [];
	}

	private async callTool(params: Record<string, unknown>): Promise<unknown> {
		// This would integrate with your existing tool execution
		// For now, throw not implemented error
		throw new Error('Tool execution not yet implemented for HTTP transport');
	}


	private generateSessionId(): string {
		const randomPart = crypto.randomBytes(16).toString('hex');
		return `mcp_${Date.now()}_${randomPart}`;
	}

	private isSessionExpired(session: { created: Date; lastAccessed: Date }): boolean {
		const now = new Date();
		const timeSinceLastAccess = now.getTime() - session.lastAccessed.getTime();
		return timeSinceLastAccess > this.sessionTTL;
	}

	private startSessionCleanup(): void {
		// Run cleanup every 5 minutes
		const cleanupIntervalMs = 5 * 60 * 1000;

		const timer = setInterval(() => {
			this.cleanupExpiredSessions();
		}, cleanupIntervalMs);
		timer.unref?.();
		this.cleanupInterval = timer;

		logger.debug(`Session cleanup started - TTL: ${this.sessionTTL}ms, Cleanup interval: ${cleanupIntervalMs}ms`);
	}

	private cleanupExpiredSessions(): void {
		let expiredCount = 0;
		const sessionIds = Array.from(this.sessions.keys());

		for (const sessionId of sessionIds) {
			const session = this.sessions.get(sessionId);
			if (session && this.isSessionExpired(session)) {
				this.sessions.delete(sessionId);
				expiredCount++;
			}
		}

		if (expiredCount > 0) {
			logger.debug(`Cleaned up ${expiredCount} expired sessions. Active sessions: ${this.sessions.size}`);
		}
	}

	private stopSessionCleanup(): void {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
			this.cleanupInterval = null;
		}
	}

	async start(): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
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
							logger.log(`   - DELETE /mcp/session/:id - Delete session`);
						}

						resolve();
					}
				);

				this.httpServer.on('error', (error) => {
					logger.error('HTTP server error:', error);
					reject(error);
				});

			} catch (error) {
				reject(error);
			}
		});
	}

	async stop(): Promise<void> {
		return new Promise((resolve) => {
			// Stop session cleanup
			this.stopSessionCleanup();

			// Clear all sessions
			this.sessions.clear();

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
