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
 * Tool descriptor interface for consistent tool representation
 */
export interface ToolDescriptor {
	name: string;
	description: string;
	inputSchema: {
		type: string;
		properties?: Record<string, unknown>;
		required?: string[];
		additionalProperties?: boolean;
		$schema?: string;
		definitions?: Record<string, unknown>;
		[key: string]: unknown;
	};
}

/**
 * Extended MCP Server with public tool access methods
 */
export class ExtendedMcpServer extends McpServer {
	/**
	 * Helper to detect Zod schemas more robustly
	 */
	private isZodSchema(obj: any): boolean {
		return obj &&
			typeof obj === 'object' &&
			obj._def &&
			typeof obj._def === 'object' &&
			typeof obj.parse === 'function' &&
			typeof obj.safeParse === 'function';
	}

	/**
	 * Get list of all registered tools in a consistent format
	 */
	public async listTools(): Promise<ToolDescriptor[]> {
		try {
			const toolsList: ToolDescriptor[] = [];

			// Access the tools from the server's internal state
			interface McpServerWithRegisteredTools {
				_registeredTools: Record<string, unknown>;
			}
			const serverInternal = this as unknown as McpServerWithRegisteredTools;

			// Ensure _registeredTools is a plain object before iterating
			if (serverInternal._registeredTools &&
				Object.prototype.toString.call(serverInternal._registeredTools) === '[object Object]') {
				// Tools are stored as a plain object - iterate only own properties
				for (const name in serverInternal._registeredTools) {
					if (!Object.prototype.hasOwnProperty.call(serverInternal._registeredTools, name)) {
						continue;
					}

					const tool = serverInternal._registeredTools[name];
					const toolData = tool as any;

					// Convert Zod schema to JSON schema if needed
					let inputSchema: {
						type: string;
						properties: Record<string, unknown>;
						required: string[];
						additionalProperties?: boolean;
						[key: string]: unknown;
					} = {
						type: 'object',
						properties: {},
						required: [],
						additionalProperties: false
					};

					if (toolData.inputSchema) {
						try {
							// If it's a Zod schema, try to convert it to JSON schema using toJSON if available
							if (this.isZodSchema(toolData.inputSchema)) {
								let zodSchema = toolData.inputSchema;
								// Try to use toJSON (Zod >=3.20.0) or zod-to-json-schema if available
								if (typeof zodSchema.toJSON === 'function') {
									inputSchema = zodSchema.toJSON();
									logger.debug(`Converted Zod schema to JSON schema using toJSON for tool: ${name}`);
								} else {
									// Try to use zod-to-json-schema if available in the environment
									try {
										const { zodToJsonSchema } = await import('zod-to-json-schema');
										inputSchema = zodToJsonSchema(zodSchema, name) as typeof inputSchema;
										logger.debug(`Converted Zod schema to JSON schema using zod-to-json-schema for tool: ${name}`);
									} catch (importErr) {
										logger.warn(
											`zod-to-json-schema not available or failed for tool: ${name}, falling back to default empty schema.`
										);
										inputSchema = {
											type: 'object',
											properties: {},
											required: [],
											additionalProperties: false
										};
									}
								}
							} else {
								// Use as-is if it's already JSON schema, with type assertion
								inputSchema = toolData.inputSchema as typeof inputSchema;
								logger.debug(`Using existing JSON schema for tool: ${name}`);
							}
						} catch (schemaError) {
							// Use default if conversion fails
							logger.error(
								`Schema conversion failed for tool ${name}: ${sanitizeErrorMessage(schemaError)}`
							);
							inputSchema = {
								type: 'object',
								properties: {},
								required: [],
								additionalProperties: false
							};
						}
					}

					toolsList.push({
						name,
						description: toolData.description || `Tool: ${name}`,
						inputSchema
					});

					logger.debug(`Added tool to list: ${name}`);
				}
			} else {
				logger.debug('_registeredTools is not a valid plain object or is null');
			}

			logger.debug(`Found ${toolsList.length} tools from _registeredTools`);
			return toolsList;
		} catch (error) {
			logger.error(`Error getting tools list: ${sanitizeErrorMessage(error)}`);
			return [];
		}
	}

	/**
	 * Invoke a tool with proper validation, lookup, and execution
	 */
	public async invokeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
		try {
			if (!name || typeof name !== 'string') {
				throw new Error('Tool name is required');
			}

			// Never log sensitive arguments; for login show only keys
			const mask = (obj: Record<string, unknown> | undefined) => {
				if (!obj) return obj;
				const SENSITIVE = /pass|secret|token|key|auth|credential/i;
				return Object.fromEntries(
					Object.entries(obj).map(([k, v]) => [k, SENSITIVE.test(k) ? '***' : v])
				);
			};
			logger.debug(`Invoking tool: ${name} with args:`, mask(args as Record<string, unknown>));

			// Access the MCP server's internal tool execution
			const serverInternal = this as any;
			if (!serverInternal._registeredTools) {
				throw new Error('No registered tools found');
			}

			// Tools are stored as a plain object
			if (!(name in serverInternal._registeredTools)) {
				throw new Error(`Tool '${name}' not found`);
			}

			const tool = serverInternal._registeredTools[name];
			if (!tool || typeof tool.callback !== 'function') {
				throw new Error(`Tool '${name}' has no valid callback`);
			}

			// Execute the tool with the provided arguments
			const result = await tool.callback(args || {});
			logger.debug(`Tool ${name} executed successfully. Result:`, mask(result as Record<string, unknown>));

			return result;
		} catch (error) {
			logger.error('Error invoking tool:', error);
			throw error;
		}
	}
}

/**
 * Creates and configures the Gauzy MCP Server
 * @param sessionId - Optional session ID for session-aware operations
 */
export function createMcpServer(sessionId?: string) {
	const server = new ExtendedMcpServer({
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
		const e = new Error(`Session manager initialization failed: ${sanitizeErrorMessage(error)}`);
		(e as any).cause = error;
		throw e;
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
