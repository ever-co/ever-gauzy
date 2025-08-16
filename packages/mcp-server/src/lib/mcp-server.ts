import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { version } from './common/version';
import { sanitizeErrorMessage } from './common/security-utils';
import { TransportFactory, TransportResult } from './transports';
import { sessionManager } from './session/session-manager';
import { registerTimerTools } from './tools/timer';
import { registerProjectTools } from './tools/projects';
import { registerTaskTools } from './tools/tasks';
import { registerEmployeeTools } from './tools/employees';
import { registerTestTools } from './tools/test-connection';
import { registerDailyPlanTools } from './tools/daily-plan';
import { registerOrganizationContactTools } from './tools/organization-contact';
import { registerAuthTools } from './tools/auth';
import { registerProductTools } from './tools/products';
import { registerProductCategoryTools } from './tools/product-categories';
import { registerInvoiceTools } from './tools/invoices';
import { registerExpenseTools } from './tools/expenses';
import { registerGoalTools } from './tools/goals';
import { registerKeyResultTools } from './tools/key-results';
import { registerDealTools } from './tools/deals';
import { registerCandidateTools } from './tools/candidates';
import { registerPaymentTools } from './tools/payments';
import { registerMerchantTools } from './tools/merchants';
import { registerIncomeTools } from './tools/incomes';
import { registerEquipmentTools } from './tools/equipment';
import { registerCommentTools } from './tools/comments';
import { registerReportTools } from './tools/reports';
import { registerTimeOffTools } from './tools/time-off';
import { registerEmployeeAwardTools } from './tools/employee-awards';
import { registerActivityLogTools } from './tools/activity-logs';
import { registerWarehouseTools } from './tools/warehouses';
import { registerPipelineTools } from './tools/pipelines';
import { registerSkillTools } from './tools/skills';

const logger = new Logger('McpServer');

/**
 * Creates and configures the Gauzy MCP Server
 * @param sessionId - Optional session ID for session-aware operations
 */
export function createMcpServer(sessionId?: string) {
	const server = new McpServer({
		name: 'gauzy-mcp-server',
		version,
		capabilities: {
			tools: {}
		}
	});

	try {
		// Register all available tools (functions that can be called by the LLM)
		registerAuthTools(server, sessionId); // Register session-aware authentication tools first
		registerTimerTools(server);
		registerProjectTools(server);
		registerTaskTools(server);
		registerEmployeeTools(server);
		registerDailyPlanTools(server);
		registerOrganizationContactTools(server);
		registerTestTools(server);

		registerProductTools(server);
		registerProductCategoryTools(server);
		registerInvoiceTools(server);
		registerExpenseTools(server);
		registerGoalTools(server);
		registerKeyResultTools(server);
		registerDealTools(server);
		registerCandidateTools(server);

		registerPaymentTools(server);
		registerMerchantTools(server);
		registerIncomeTools(server);
		registerEquipmentTools(server);
		registerCommentTools(server);
		registerReportTools(server);
		registerTimeOffTools(server);
		registerEmployeeAwardTools(server);
		registerActivityLogTools(server);
		registerWarehouseTools(server);
		registerPipelineTools(server);
		registerSkillTools(server);

		logger.log('Gauzy MCP Server: All tools registered successfully');
	} catch (error) {
		logger.error('Error configuring Gauzy MCP Server', error instanceof Error ? error.stack : String(error));
		throw error;
	}

	return { server, version };
}

/**
 * Creates and configures the Gauzy MCP Server with session manager initialization
 * This is the recommended way to create the server for production use
 */
export async function createMcpServerAsync(sessionId?: string) {
	try {
		// Initialize session manager first
		await sessionManager.initialize();
		logger.log('Session manager initialized successfully');

		// Create server with session support
		return createMcpServer(sessionId);
	} catch (error) {
		logger.error(`Failed to initialize session manager: ${sanitizeErrorMessage(error)}`);
    	throw new Error(`Session manager initialization failed: ${sanitizeErrorMessage(error)}`);
	}
}

/**
 * Creates a standalone MCP server that can be used by external clients like Claude Desktop
 * @deprecated Use createStandaloneMcpServerAsync for proper session support
 */
export function createStandaloneMcpServer() {
	const { server } = createMcpServer();

	logger.log('Standalone MCP Server created for external clients');
	return server;
}

/**
 * Creates a standalone MCP server with proper session initialization
 */
export async function createStandaloneMcpServerAsync() {
	const { server } = await createMcpServerAsync();

	logger.log('Standalone MCP Server created for external clients with session support');
	return server;
}

/**
 * Creates and starts an MCP server with the appropriate transport
 */
export async function createAndStartMcpServer(): Promise<{ server: McpServer; transport: TransportResult }> {
	// Use async version for proper session initialization
	const { server } = await createMcpServerAsync();

	// Create transport based on configuration
	const transport = await TransportFactory.createTransport(server);

	// Connect server to transport
	await TransportFactory.connectServer(server, transport);

	return { server, transport };
}

// Check if this file is being run directly
function isMainModule() {
	try {
		// Use __filename to check if this is the main module
		const url = new URL(__filename);
		const mainModuleUrl = new URL(process.argv[1], 'file://');
		return url.pathname === mainModuleUrl.pathname;
	} catch (error) {
		// Fallback: check if process.argv[1] ends with this filename
		return process.argv[1]?.endsWith('mcp-server') || process.argv[1]?.endsWith('mcp-server.ts');
	}
}

// If this file is run directly, start the server for external MCP clients
if (isMainModule()) {
	let currentTransport: TransportResult | null = null;

	async function main() {
		try {
			logger.log('Starting Gauzy MCP Server for external clients...');

			const { transport } = await createAndStartMcpServer();
			currentTransport = transport;

			logger.log(`✅ Gauzy MCP Server running on ${transport.type} transport - version: ${version}`);

			if (transport.type === 'http' && transport.url) {
				logger.log(`🌐 HTTP transport available at: ${transport.url}`);
				logger.log(`📡 API endpoints:`);
				logger.log(`   - GET  ${transport.url}/health`);
				logger.log(`   - POST ${transport.url}/mcp`);
				logger.log(`   - GET  ${transport.url}/mcp/events`);
			} else {
				logger.log('📟 Server is ready to accept MCP requests via stdio');
			}

			logger.log('🎯 Server is ready to accept MCP requests from clients like Claude Desktop');
		} catch (error) {
			logger.error('Fatal error starting Gauzy MCP Server', error instanceof Error ? error.stack : String(error));
			process.exit(1);
		}
	}

	// Handle graceful shutdown
	async function shutdown(signal: string) {
		logger.log(`Received ${signal}, shutting down gracefully...`);
		let hasShutdownErrors = false;

		if (currentTransport) {
			try {
				await TransportFactory.shutdownTransport(currentTransport);
				logger.log('Transport shutdown completed successfully');
			} catch (error) {
				logger.error('Error during shutdown:', error);
				hasShutdownErrors = true;
			}
		}

		const exitCode = hasShutdownErrors ? 1 : 0;
		logger.log(`Shutdown ${hasShutdownErrors ? 'completed with errors' : 'completed successfully'}, exiting with code ${exitCode}`);
		process.exit(exitCode);
	}

	process.on('SIGINT', () => shutdown('SIGINT'));
	process.on('SIGTERM', () => shutdown('SIGTERM'));

	main();
}
