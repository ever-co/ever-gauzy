import { Logger } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import express from 'express';
import cors from 'cors';
import { Server } from 'http';
import { config, McpTransportConfig } from '../common/config';

const logger = new Logger('HttpTransport');

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

	constructor(options: HttpTransportOptions) {
		this.mcpServer = options.server;
		this.transportConfig = options.transportConfig!;
		this.app = express();
		this.setupMiddleware();
		this.setupRoutes();
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
						session.lastAccessed = new Date();
						(req as any).sessionId = sessionId;
					}
				}
				next();
			});
		}
	}

	private setupRoutes() {
		// Health check endpoint
		this.app.get('/health', (req, res) => {
			res.json({
				status: 'healthy',
				timestamp: new Date().toISOString(),
				transport: 'http',
				server: 'gauzy-mcp-server'
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
			this.app.post('/mcp/session', (req, res) => {
				const sessionId = this.generateSessionId();
				const session = {
					id: sessionId,
					created: new Date(),
					lastAccessed: new Date()
				};
				this.sessions.set(sessionId, session);

				res.json({
					sessionId,
					created: session.created,
					cookieName: this.transportConfig.session.cookieName
				});
			});

			this.app.delete('/mcp/session/:sessionId', (req, res) => {
				const sessionId = req.params.sessionId;
				if (this.sessions.delete(sessionId)) {
					res.json({ message: 'Session deleted' });
				} else {
					res.status(404).json({ error: 'Session not found' });
				}
			});
		}
	}

	private async handleMcpRequest(req: express.Request, res: express.Response) {
		const { method, params, id } = req.body;

		if (!method) {
			res.status(400).json({
				error: 'Bad Request',
				message: 'Missing method in request body'
			});
			return;
		}

		try {
			// Validate Origin header for security
			const origin = req.headers.origin;
			if (origin && !this.isValidOrigin(origin)) {
				res.status(403).json({
					error: 'Forbidden',
					message: 'Invalid origin'
				});
				return;
			}

			// Create a mock transport interface for the MCP server
			const mockTransport = {
				start: async () => {},
				close: async () => {},
				send: (response: any) => {
					// Send response back to HTTP client
					if (id) {
						res.json({
							jsonrpc: '2.0',
							id,
							...response
						});
					} else {
						// Handle notifications (no response expected)
						res.status(200).end();
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
		// Set SSE headers
		const origin = this.transportConfig.cors.origin;
		const originHeader = typeof origin === 'string' ? origin : 
			Array.isArray(origin) ? origin[0] || '*' : '*';
		
		res.writeHead(200, {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			'Connection': 'keep-alive',
			'Access-Control-Allow-Origin': originHeader,
			'Access-Control-Allow-Credentials': 'true'
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
		}, 30000);

		// Clean up on client disconnect
		req.on('close', () => {
			clearInterval(keepAlive);
			res.end();
		});
	}

	private async routeMcpRequest(method: string, params: any, id: any, transport: any) {
		try {
			// Create a JSON-RPC request message
			const request = {
				jsonrpc: '2.0',
				id,
				method,
				params: params || {}
			};

			// Convert the HTTP request into a format the MCP server can handle
			// This is a placeholder - the actual implementation would need to 
			// properly integrate with the MCP server's request handling
			
			// For now, handle basic MCP protocol methods
			switch (method) {
				case 'initialize':
					transport.send({
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
					// This would need to integrate with your tools registry
					const tools: any[] = [];
					transport.send({
						result: { tools }
					});
					break;

				case 'tools/call':
					// This would need to integrate with your tool execution system
					throw new Error('Tool execution requires proper MCP server integration');

				default:
					transport.send({
						error: {
							code: -32601,
							message: `Method not found: ${method}`
						}
					});
			}
		} catch (error) {
			transport.send({
				error: {
					code: -32603,
					message: 'Internal error',
					data: error instanceof Error ? error.message : 'Unknown error'
				}
			});
		}
	}

	private async getTools(): Promise<any[]> {
		// This would integrate with your existing tools registry
		// For now, return empty array - you'll need to implement tool listing
		return [];
	}

	private async callTool(params: any): Promise<any> {
		// This would integrate with your existing tool execution
		// For now, throw not implemented error
		throw new Error('Tool execution not yet implemented for HTTP transport');
	}

	private isValidOrigin(origin: string): boolean {
		const allowedOrigins = this.transportConfig.cors.origin;
		
		if (allowedOrigins === true) return true;
		if (allowedOrigins === false) return false;
		
		if (Array.isArray(allowedOrigins)) {
			return allowedOrigins.includes(origin);
		}
		
		return allowedOrigins === origin;
	}

	private generateSessionId(): string {
		return `mcp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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