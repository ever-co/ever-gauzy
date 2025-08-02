import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Logger } from '@nestjs/common';
import { version } from './common/version';
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
 * Creates a standalone MCP server that can be used by external clients like Claude Desktop
 */
export function createStandaloneMcpServer() {
	const { server } = createMcpServer();

	logger.log('Standalone MCP Server created for external clients');
	return server;
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
	async function main() {
		try {
			logger.log('Starting Gauzy MCP Server for external clients...');

			const server = createStandaloneMcpServer();
			const transport = new StdioServerTransport();

			await server.connect(transport);

			// Use stderr for logging (stdout is used for MCP communication)
			logger.log(`Gauzy MCP Server running on stdio transport - version: ${version}`);
			logger.log('Server is ready to accept MCP requests from clients like Claude Desktop');
		} catch (error) {
			logger.error('Fatal error starting Gauzy MCP Server', error instanceof Error ? error.stack : String(error));
			process.exit(1);
		}
	}

	// Handle graceful shutdown
	process.on('SIGINT', () => {
		logger.log('Received SIGINT, shutting down gracefully...');
		process.exit(0);
	});

	process.on('SIGTERM', () => {
		logger.log('Received SIGTERM, shutting down gracefully...');
		process.exit(0);
	});

	main();
}
