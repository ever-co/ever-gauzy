import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { version } from './common/version.js';
import { registerTimerTools } from './tools/timer.js';
import { registerProjectTools } from './tools/projects.js';
import { registerTaskTools } from './tools/tasks.js';
import { registerEmployeeTools } from './tools/employees.js';
import { registerTestTools } from './tools/test-connection.js';
import { registerDailyPlanTools } from './tools/daily-plan.js';
import { registerOrganizationContactTools } from './tools/organization-contact.js';
import { registerAuthTools } from './tools/auth.js';
import log from 'electron-log';

/**
 * Creates and configures the Gauzy MCP Server
 */
export function createMcpServer() {
	const server = new McpServer({
		name: 'gauzy-mcp-server',
		version,
		capabilities: {
			tools: {}
		}
	});

	try {
		// Register all available tools (functions that can be called by the LLM)
		registerAuthTools(server); // Register authentication tools first
		registerTimerTools(server);
		registerProjectTools(server);
		registerTaskTools(server);
		registerEmployeeTools(server);
		registerDailyPlanTools(server);
		registerOrganizationContactTools(server);
		registerTestTools(server);

		log.info('Gauzy MCP Server: All tools registered successfully');
	} catch (error) {
		log.error('Error configuring Gauzy MCP Server:', error);
		throw error;
	}

	return { server, version };
}

/**
 * Creates a standalone MCP server that can be used by external clients like Claude Desktop
 */
export function createStandaloneMcpServer() {
	const { server } = createMcpServer();

	log.info('Standalone MCP Server created for external clients');
	return server;
}

// Check if this file is being run directly
function isMainModule() {
	try {
		// In ES modules, we need to use import.meta.url to check if this is the main module
		const url = new URL(import.meta.url);
		const mainModuleUrl = new URL(process.argv[1], 'file://');
		return url.pathname === mainModuleUrl.pathname;
	} catch (error) {
		// Fallback: check if process.argv[1] ends with this filename
		return process.argv[1]?.endsWith('mcp-server.js') || process.argv[1]?.endsWith('mcp-server.ts');
	}
}

// If this file is run directly, start the server for external MCP clients
if (isMainModule()) {
	async function main() {
		try {
			log.info('Starting Gauzy MCP Server for external clients...');

			const server = createStandaloneMcpServer();
			const transport = new StdioServerTransport();

			await server.connect(transport);

			// Use stderr for logging (stdout is used for MCP communication)
			log.info(`Gauzy MCP Server running on stdio transport - version: ${version}`);
			log.info('Server is ready to accept MCP requests from clients like Claude Desktop');
		} catch (error) {
			log.error('Fatal error starting Gauzy MCP Server:', error);
			process.exit(1);
		}
	}

	// Handle graceful shutdown
	process.on('SIGINT', () => {
		log.info('Received SIGINT, shutting down gracefully...');
		process.exit(0);
	});

	process.on('SIGTERM', () => {
		log.info('Received SIGTERM, shutting down gracefully...');
		process.exit(0);
	});

	main();
}
