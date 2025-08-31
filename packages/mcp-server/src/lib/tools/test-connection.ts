import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { version } from '../common/version';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { sanitizeErrorMessage, sanitizeForLogging } from '../common/security-utils';
import { TOOLS_REGISTRY, getToolCounts, getTotalToolCount } from '../config/index';
import { SERVER_INFO } from '../config/server-info';

const logger = new Logger('TestConnectionTools');

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
            logger.error('Error testing API connection:', sanitizeForLogging(error));
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
                name: SERVER_INFO.name,
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
                capabilities: SERVER_INFO.capabilities,
                features: SERVER_INFO.features
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
            logger.error('Error getting server info:', sanitizeForLogging(error));
            const message = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to get server information: ${sanitizeErrorMessage(message)}`);
        }
    });

    // Test MCP capabilities
    server.tool('test_mcp_capabilities', 'Test all MCP server tools and list available functionality', {}, async () => {
        try {
            // Use the centralized tools registry
            const tools = TOOLS_REGISTRY;
            const toolCounts = getToolCounts();
            const totalTools = getTotalToolCount();

            const results = {
                tools,
                toolCounts,
                totalTools,
                serverInfo: {
                    name: SERVER_INFO.name,
                    version,
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
                    userContextAware: "✅ All tools work within authenticated user's context automatically"
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
            logger.error('Error testing MCP capabilities:', sanitizeForLogging(error));
            const message = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to test MCP capabilities: ${sanitizeErrorMessage(message)}`);
        }
    });
    logger.log('Test connection tools registered successfully');
};
