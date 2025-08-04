import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { sanitizeErrorMessage, sanitizeForLogging } from '../common/security-utils';

const logger = new Logger('AuthTools');

/**
 * Register authentication tools with the MCP server
 * These tools handle user authentication, login, logout, and status checking
 */
export const registerAuthTools = (server: McpServer) => {
	// Login with email and password
	server.tool(
		'login',
		'Login to Gauzy with email and password',
		{
			email: z.string().email().describe('Email address for authentication'),
			password: z.string().min(1).describe('Password for authentication')
		},
		async ({ email, password }) => {
			try {
				const result = await apiClient.login(email, password);

				if (result.success) {
					const authStatus = authManager.getAuthStatus();
					return {
						content: [
							{
								type: 'text',
								text: `✅ Login successful!

								User ID: ${authStatus.userId || 'Unknown'}
								Token expires: ${authStatus.tokenExpiresAt?.toISOString() || 'Unknown'}
								Authentication status: ${authStatus.isAuthenticated ? 'Authenticated' : 'Not authenticated'}`
							}
						]
					};
				} else {
					return {
						content: [
							{
								type: 'text',
								text: `❌ Login failed: ${result.error || 'Unknown error'}`
							}
						]
					};
				}
			} catch (error) {
				logger.error('Login tool error:', sanitizeForLogging(error));
				return {
					content: [
						{
							type: 'text',
							text: `❌ Login failed: ${sanitizeErrorMessage(error)}`
						}
					]
				};
			}
		}
	);

	// Logout
	server.tool('logout', 'Logout from Gauzy and clear authentication tokens', {}, async () => {
		try {
			await apiClient.logout();
			return {
				content: [
					{
						type: 'text',
						text: '✅ Logout successful. Authentication tokens have been cleared.'
					}
				]
			};
		} catch (error) {
			logger.error('Logout tool error:', sanitizeForLogging(error));
			return {
				content: [
					{
						type: 'text',
						text: `⚠️  Logout completed with warning: ${sanitizeErrorMessage(error)}`
					}
				]
			};
		}
	});

	// Get authentication status
	server.tool('get_auth_status', 'Get current authentication status and user information', {}, async () => {
		try {
			const authStatus = authManager.getAuthStatus();

			const statusText = `🔐 Authentication Status:

			Authenticated: ${authStatus.isAuthenticated ? '✅ Yes' : '❌ No'}
			Has Access Token: ${authStatus.hasToken ? '✅ Yes' : '❌ No'}
			Has Refresh Token: ${authStatus.hasRefreshToken ? '✅ Yes' : '❌ No'}
			User ID: ${authStatus.userId || '❌ Not available'}
			Token Expires: ${authStatus.tokenExpiresAt?.toISOString() || '❌ Not available'}
			Auto Login Enabled: ${authStatus.autoLoginEnabled ? '✅ Yes' : '❌ No'}

${
	authStatus.isAuthenticated
		? '✅ Ready to make authenticated API calls'
		: '⚠️  Authentication required for API calls'
}`;

			return {
				content: [
					{
						type: 'text',
						text: statusText
					}
				]
			};
		} catch (error) {
			logger.error('Auth status tool error:', sanitizeForLogging(error));
			return {
				content: [
					{
						type: 'text',
						text: `❌ Failed to get authentication status: ${sanitizeErrorMessage(error)}`
					}
				]
			};
		}
	});

	// Refresh authentication token
	server.tool('refresh_auth_token', 'Manually refresh the authentication token', {}, async () => {
		try {
			const success = await authManager.refreshToken();

			if (success) {
				const authStatus = authManager.getAuthStatus();
				return {
					content: [
						{
							type: 'text',
							text: `✅ Token refreshed successfully!

New token expires: ${authStatus.tokenExpiresAt?.toISOString() || 'Unknown'}
Authentication status: ${authStatus.isAuthenticated ? 'Authenticated' : 'Not authenticated'}`
						}
					]
				};
			} else {
				return {
					content: [
						{
							type: 'text',
							text: '❌ Token refresh failed. You may need to login again.'
						}
					]
				};
			}
		} catch (error) {
			logger.error('Token refresh tool error:', sanitizeForLogging(error));
			return {
				content: [
					{
						type: 'text',
						text: `❌ Token refresh failed: ${sanitizeErrorMessage(error)}`
					}
				]
			};
		}
	});

	// Auto-login (if configured)
	server.tool('auto_login', 'Attempt automatic login using configured credentials', {}, async () => {
		try {
			const success = await authManager.autoLogin();

			if (success) {
				const authStatus = authManager.getAuthStatus();
				return {
					content: [
						{
							type: 'text',
							text: `✅ Auto-login successful!

User ID: ${authStatus.userId || 'Unknown'}
Token expires: ${authStatus.tokenExpiresAt?.toISOString() || 'Unknown'}
Authentication status: ${authStatus.isAuthenticated ? 'Authenticated' : 'Not authenticated'}`
						}
					]
				};
			} else {
				return {
					content: [
						{
							type: 'text',
							text: '❌ Auto-login failed. Auto-login may not be configured or credentials may be incorrect.'
						}
					]
				};
			}
		} catch (error) {
			logger.error('Auto-login tool error:', sanitizeForLogging(error));
			return {
				content: [
					{
						type: 'text',
						text: `❌ Auto-login failed: ${sanitizeErrorMessage(error)}`
					}
				]
			};
		}
	});

	logger.log('Authentication tools registered successfully');
};
