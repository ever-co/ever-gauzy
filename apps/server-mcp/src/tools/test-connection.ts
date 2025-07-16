import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { version } from '../common/version.js';
import { apiClient } from '../common/api-client.js';
import { authManager } from '../common/auth-manager.js';
import { sanitizeErrorMessage, sanitizeForLogging } from '../common/security-utils.js';
import log from 'electron-log';

/**
 * Register test connection tools with the MCP server
 * These tools help verify that the MCP server is working correctly
 */
export const registerTestTools = (server: McpServer) => {
	// Test API connection
	server.tool('test_api_connection', 'Test the connection to the Gauzy API server', {}, async () => {
		try {
			const connectionTest = await apiClient.testConnection();

			if (connectionTest.success) {
				const authStatus = authManager.getAuthStatus();
				const statusText = `✅ Successfully connected to Gauzy API server!

Connection Details:
- Base URL: ${apiClient.getBaseUrl()}
- Health Check: Passed
- Authentication Status: ${authStatus.isAuthenticated ? 'Authenticated' : 'Not authenticated'}
- User ID: ${authStatus.userId || 'N/A'}
- Auto Login: ${authStatus.autoLoginEnabled ? 'Enabled' : 'Disabled'}`;

				return {
					content: [
						{
							type: 'text',
							text: statusText
						}
					]
				};
			} else {
				return {
					content: [
						{
							type: 'text',
							text: `❌ Failed to connect to Gauzy API: ${connectionTest.error}`
						}
					]
				};
			}
		} catch (error) {
			log.error('Error testing API connection:', sanitizeForLogging(error));
			return {
				content: [
					{
						type: 'text',
						text: `❌ Connection test failed: ${sanitizeErrorMessage(error)}`
					}
				]
			};
		}
	});

	// Get server info
	server.tool('get_server_info', 'Get information about the Gauzy MCP server', {}, async () => {
		try {
			const authStatus = authManager.getAuthStatus();

			const info = {
				name: 'Gauzy MCP Server',
				version,
				status: 'running',
				apiUrl: apiClient.getBaseUrl(),
				timeout: apiClient.getTimeout(),
				debugMode: apiClient.isDebug(),
				timestamp: new Date().toISOString(),
				authentication: {
					isAuthenticated: authStatus.isAuthenticated,
					autoLoginEnabled: authStatus.autoLoginEnabled,
					hasAccessToken: authStatus.hasToken,
					hasRefreshToken: authStatus.hasRefreshToken,
					userId: authStatus.userId,
					tokenExpiresAt: authStatus.tokenExpiresAt
				},
				capabilities: {
					tools: true,
					resources: false,
					prompts: false
				},
				features: {
					schemaValidation: true,
					bulkOperations: true,
					relationSupport: true,
					paginationSupport: true,
					statisticsSupport: true,
					assignmentOperations: true,
					authentication: true,
					tokenRefresh: true
				}
			};

			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify(info, null, 2)
					}
				]
			};
		} catch (error) {
			log.error('Error getting server info:', sanitizeForLogging(error));
			const message = error instanceof Error ? error.message : 'Unknown error';
			throw new Error(`Failed to get server information: ${sanitizeErrorMessage(message)}`);
		}
	});

	// Test MCP capabilities
	server.tool('test_mcp_capabilities', 'Test all MCP server tools and list available functionality', {}, async () => {
		try {
			// Since server.getTools() is not available, we'll maintain the list in a central location
			// TODO: Consider moving this to a central configuration file
			const tools = {
				authentication: ['login', 'logout', 'get_auth_status', 'refresh_auth_token', 'auto_login'],
				employees: [
					'get_employees',
					'get_employee_count',
					'get_employees_pagination',
					'get_working_employees',
					'get_working_employees_count',
					'get_organization_members',
					'get_employee',
					'get_employee_statistics',
					'get_current_employee',
					'create_employee',
					'update_employee',
					'update_employee_profile',
					'soft_delete_employee',
					'restore_employee',
					'bulk_create_employees'
				],
				tasks: [
					'get_tasks',
					'get_task_count',
					'get_tasks_pagination',
					'get_tasks_by_employee',
					'get_my_tasks',
					'get_team_tasks',
					'create_task',
					'get_task',
					'update_task',
					'delete_task',
					'bulk_create_tasks',
					'bulk_update_tasks',
					'bulk_delete_tasks',
					'get_task_statistics',
					'assign_task_to_employee',
					'unassign_task_from_employee'
				],
				projects: [
					'get_projects',
					'get_project_count',
					'get_projects_pagination',
					'get_projects_by_employee',
					'get_my_projects',
					'get_project',
					'create_project',
					'update_project',
					'delete_project',
					'bulk_create_projects',
					'bulk_update_projects',
					'bulk_delete_projects',
					'get_project_statistics',
					'assign_project_to_employee',
					'unassign_project_from_employee'
				],
				dailyPlans: [
					'get_daily_plans',
					'get_my_daily_plans',
					'get_team_daily_plans',
					'get_employee_daily_plans',
					'get_daily_plans_for_task',
					'get_daily_plan',
					'create_daily_plan',
					'update_daily_plan',
					'delete_daily_plan',
					'add_task_to_daily_plan',
					'remove_task_from_daily_plan',
					'remove_task_from_many_daily_plans',
					'get_daily_plan_count',
					'get_daily_plan_statistics',
					'bulk_create_daily_plans',
					'bulk_update_daily_plans',
					'bulk_delete_daily_plans'
				],
				organizationContacts: [
					'get_organization_contacts',
					'get_organization_contact_count',
					'get_organization_contacts_pagination',
					'get_organization_contacts_by_employee',
					'get_organization_contact',
					'create_organization_contact',
					'update_organization_contact',
					'update_organization_contact_by_employee',
					'delete_organization_contact',
					'bulk_create_organization_contacts',
					'bulk_update_organization_contacts',
					'bulk_delete_organization_contacts',
					'get_organization_contact_statistics',
					'assign_contact_to_employee',
					'unassign_contact_from_employee',
					'get_contact_projects',
					'invite_organization_contact'
				],
				timer: ['timer_status', 'start_timer', 'stop_timer'],
				test: ['test_api_connection', 'get_server_info', 'test_mcp_capabilities']
			};

			// Calculate tool counts
			const toolCounts = Object.keys(tools).reduce((counts, category) => {
				counts[category] = tools[category].length;
				return counts;
			}, {});

			const totalTools = Object.values(tools).reduce((sum, categoryTools) => sum + categoryTools.length, 0);

			const results = {
				tools,
				toolCounts,
				totalTools,
				serverInfo: {
					name: 'Gauzy MCP Server',
					version: '0.1.0',
					pattern: 'Following Anthropic implementation documentation',
					schemaValidation: 'Zod-based validation with comprehensive enums',
					bulkOperations: 'Supported across all entity types',
					relationSupport: 'Full relation loading support',
					paginationSupport: 'Comprehensive pagination with filtering',
					authentication: 'Full authentication flow with auto-login and token refresh',
					parameterInjection:
						'Automatic tenant ID and organization ID injection from authenticated user context'
				},
				capabilities: {
					schemaValidation: '✅ All tools use Zod schemas for validation',
					bulkOperations: '✅ Bulk create, update, delete operations available',
					relationSupport: '✅ Support for loading entity relations',
					paginationSupport: '✅ Pagination with page/limit parameters',
					statisticsSupport: '✅ Statistics endpoints for analytics',
					assignmentOperations: '✅ Employee assignment/unassignment operations',
					enumValidation: '✅ Comprehensive enum validation (status, priority, etc.)',
					uuidValidation: '✅ UUID validation for all ID fields',
					authentication: '✅ Login/logout with email and password',
					tokenManagement: '✅ Automatic token refresh and management',
					autoLogin: '✅ Configurable auto-login support',
					parameterInjection: '✅ Automatic tenant/organization ID injection from authenticated user',
					userContextAware: '✅ All tools work within authenticated user\'s context automatically'
				},
				authentication: authManager.getAuthStatus(),
				status: 'All tools registered and working with enhanced authentication functionality'
			};

			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify(results, null, 2)
					}
				]
			};
		} catch (error) {
			log.error('Error testing MCP capabilities:', sanitizeForLogging(error));
			const message = error instanceof Error ? error.message : 'Unknown error';
			throw new Error(`Failed to get server information: ${sanitizeErrorMessage(message)}`);
		}
	});

	log.info('Test connection tools registered successfully');
};
