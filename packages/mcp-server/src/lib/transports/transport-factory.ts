import { Logger } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { HttpTransport } from './http-transport';
import { WebSocketTransport } from './websocket-transport';
import { config, McpTransportType } from '../common/config';
import { ExtendedMcpServer } from '../mcp-server';

const logger = new Logger('TransportFactory');

export interface TransportResult {
	type: McpTransportType;
	transport?: StdioServerTransport | HttpTransport | WebSocketTransport;
	url?: string;
}

export class TransportFactory {
	/**
	 * Creates the appropriate transport based on configuration and environment
	 */
	static async createTransport(server: ExtendedMcpServer): Promise<TransportResult> {
		const transportType = TransportFactory.detectTransportType();

		logger.log(`🚌 Creating ${transportType} transport...`);

		switch (transportType) {
			case 'stdio':
				return TransportFactory.createStdioTransport(server);

			case 'http':
				return await TransportFactory.createHttpTransport(server);

			case 'websocket':
				return await TransportFactory.createWebSocketTransport(server);

			case 'auto':
				return await TransportFactory.createAutoTransport(server);

			default:
				throw new Error(`Unsupported transport type: ${transportType}`);
		}
	}

	/**
	 * Detects the transport type based on environment and configuration
	 */
	private static detectTransportType(): McpTransportType {
		// Check explicit configuration first
		const configuredType = config.mcp.transport.type;
		if (configuredType !== 'auto') {
			return configuredType;
		}

		// Auto-detection logic using helper methods
		if (TransportFactory.isRunningInCI()) {
			return 'stdio';
		}

		if (TransportFactory.hasStdioPipes()) {
			return 'stdio';
		}

		if (TransportFactory.isWebSocketConfigured()) {
			return 'websocket';
		}

		if (TransportFactory.isHttpConfigured()) {
			return 'http';
		}

		if (TransportFactory.isProductionOrServerMode()) {
			return 'http';
		}

		// Default to stdio for development
		return 'stdio';
	}

	/**
	 * Checks if running in CI environment
	 */
	private static isRunningInCI(): boolean {
		return process.env.CI === 'true';
	}

	/**
	 * Checks if we have a parent process with stdio pipes
	 */
	private static hasStdioPipes(): boolean {
		return !process.stdin.isTTY || !process.stdout.isTTY || !process.stderr.isTTY;
	}

	/**
	 * Checks if WebSocket transport is explicitly configured
	 */
	private static isWebSocketConfigured(): boolean {
		return !!process.env.MCP_WS_PORT || !!config.mcp.transport.websocket;
	}

	/**
	 * Checks if HTTP transport is explicitly configured
	 */
	private static isHttpConfigured(): boolean {
		return !!process.env.MCP_HTTP_PORT;
	}

	/**
	 * Checks if running in production or server mode
	 */
	private static isProductionOrServerMode(): boolean {
		return process.env.NODE_ENV === 'production' || process.env.MCP_SERVER_MODE === 'http';
	}

	/**
	 * Creates a stdio transport
	 */
	private static createStdioTransport(server: ExtendedMcpServer): TransportResult {
		logger.log('📟 Setting up stdio transport for MCP communication');

		const transport = new StdioServerTransport();

		return {
			type: 'stdio',
			transport
		};
	}

	/**
	 * Creates an HTTP transport
	 */
	private static async createHttpTransport(server: ExtendedMcpServer): Promise<TransportResult> {
		logger.log('🌐 Setting up HTTP transport for MCP communication');

		const httpTransport = new HttpTransport({
			server,
			transportConfig: config.mcp.transport.http || {
				port: 3001,
				host: 'localhost',
				cors: { origin: ['http://localhost:3000'], credentials: true },
				session: { enabled: true, cookieName: 'mcp-session-id' }
			}
		});

		// Start the HTTP server
		await httpTransport.start();

		return {
			type: 'http',
			transport: httpTransport,
			url: httpTransport.getUrl()
		};
	}

	/**
	 * Creates a WebSocket transport
	 */
	private static async createWebSocketTransport(server: ExtendedMcpServer): Promise<TransportResult> {
		logger.log('⚡ Setting up WebSocket transport for MCP communication');

		const wsTransport = new WebSocketTransport({
			server,
			transportConfig: config.mcp.transport.websocket || {
				port: 3002,
				host: 'localhost',
				compression: true,
				maxPayload: 16777216,
				session: { enabled: true, cookieName: 'mcp-ws-session-id' }
			}
		});

		// Start the WebSocket server
		await wsTransport.start();

		return {
			type: 'websocket',
			transport: wsTransport,
			url: wsTransport.getUrl()
		};
	}

	/**
	 * Creates transport with automatic fallback
	 */
	private static async createAutoTransport(server: ExtendedMcpServer): Promise<TransportResult> {
		logger.log('🔄 Auto-detecting best transport method...');

		try {
			// Try WebSocket first if we're in server mode and WebSocket is preferred
			if (TransportFactory.shouldPreferWebSocket()) {
				try {
					return await TransportFactory.createWebSocketTransport(server);
				} catch (wsError) {
					logger.warn('Failed to start WebSocket transport, trying HTTP:', wsError);
				}
			}

			// Try HTTP if we're in server mode
			if (TransportFactory.shouldPreferHttp()) {
				try {
					return await TransportFactory.createHttpTransport(server);
				} catch (httpError) {
					logger.warn('Failed to start HTTP transport, falling back to stdio:', httpError);
				}
			}

			// Fall back to stdio
			return TransportFactory.createStdioTransport(server);

		} catch (error) {
			logger.error('Failed to create any transport:', error);
			throw new Error(`Failed to create MCP transport: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Determines if WebSocket transport should be preferred in auto mode
	 */
	private static shouldPreferWebSocket(): boolean {
		return (
			process.env.MCP_SERVER_MODE === 'websocket' ||
			process.env.MCP_WS_PORT !== undefined ||
			process.argv.includes('--websocket') ||
			process.argv.includes('--ws')
		);
	}

	/**
	 * Determines if HTTP transport should be preferred in auto mode
	 */
	private static shouldPreferHttp(): boolean {
		return (
			process.env.NODE_ENV === 'production' ||
			process.env.MCP_SERVER_MODE === 'http' ||
			process.env.MCP_HTTP_PORT !== undefined ||
			process.argv.includes('--http')
		);
	}

	/**
	 * Connects the server to the transport
	 */
	static async connectServer(server: ExtendedMcpServer, transportResult: TransportResult): Promise<void> {
		const { type, transport } = transportResult;

		if (!transport) {
			throw new Error('No transport available to connect');
		}

		if (type === 'stdio') {
			// Connect to stdio transport
			await server.connect(transport as StdioServerTransport);
			logger.log('✅ MCP Server connected via stdio transport');
		} else if (type === 'http') {
			// HTTP transport is already started, just log success
			logger.log(`✅ MCP Server connected via HTTP transport at ${transportResult.url}`);
		} else if (type === 'websocket') {
			// WebSocket transport is already started, just log success
			logger.log(`✅ MCP Server connected via WebSocket transport at ${transportResult.url}`);
		}
	}

	/**
	 * Gracefully shuts down the transport
	 */
	static async shutdownTransport(transportResult: TransportResult): Promise<void> {
		const { type, transport } = transportResult;

		if (!transport) {
			return;
		}

		try {
			if (type === 'http' && transport instanceof HttpTransport) {
				await transport.stop();
			} else if (type === 'websocket' && transport instanceof WebSocketTransport) {
				await transport.stop();
			}
			// Stdio transport doesn't need explicit shutdown

			logger.log(`🛑 ${type} transport shut down successfully`);
		} catch (error) {
			logger.error(`Error shutting down ${type} transport:`, error);
		}
	}
}
