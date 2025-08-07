import { Logger } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { HttpTransport } from './http-transport';
import { config, McpTransportType } from '../common/config';

const logger = new Logger('TransportFactory');

export interface TransportResult {
	type: McpTransportType;
	transport?: StdioServerTransport | HttpTransport;
	url?: string;
}

export class TransportFactory {
	/**
	 * Creates the appropriate transport based on configuration and environment
	 */
	static async createTransport(server: McpServer): Promise<TransportResult> {
		const transportType = TransportFactory.detectTransportType();
		
		logger.log(`🚌 Creating ${transportType} transport...`);

		switch (transportType) {
			case 'stdio':
				return TransportFactory.createStdioTransport(server);
			
			case 'http':
				return await TransportFactory.createHttpTransport(server);
			
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

		// Auto-detection logic
		// If running in CI/test environment, prefer stdio
		if (process.env.CI === 'true' || process.env.NODE_ENV === 'test') {
			return 'stdio';
		}

		// If we have a parent process with stdio pipes, use stdio
		if (process.stdin.isTTY === false && process.stdout.isTTY === false) {
			return 'stdio';
		}

		// If MCP_HTTP_PORT is set, prefer HTTP
		if (process.env.MCP_HTTP_PORT) {
			return 'http';
		}

		// If running in production or server environment, prefer HTTP
		if (process.env.NODE_ENV === 'production' || process.env.MCP_SERVER_MODE === 'http') {
			return 'http';
		}

		// Default to stdio for development
		return 'stdio';
	}

	/**
	 * Creates a stdio transport
	 */
	private static createStdioTransport(server: McpServer): TransportResult {
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
	private static async createHttpTransport(server: McpServer): Promise<TransportResult> {
		logger.log('🌐 Setting up HTTP transport for MCP communication');
		
		const httpTransport = new HttpTransport({
			server,
			transportConfig: config.mcp.transport.http
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
	 * Creates transport with automatic fallback
	 */
	private static async createAutoTransport(server: McpServer): Promise<TransportResult> {
		logger.log('🔄 Auto-detecting best transport method...');

		try {
			// Try HTTP first if we're in server mode
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
	static async connectServer(server: McpServer, transportResult: TransportResult): Promise<void> {
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
			}
			// Stdio transport doesn't need explicit shutdown
			
			logger.log(`🛑 ${type} transport shut down successfully`);
		} catch (error) {
			logger.error(`Error shutting down ${type} transport:`, error);
		}
	}
}