import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { sessionManager } from '../session/session-manager';
import { sanitizeErrorMessage, sanitizeForLogging } from '../common/security-utils';
import type { SessionData } from '../session/session-store';

const logger = new Logger('AuthTools');

/**
 * Register authentication tools with the MCP server
 * These tools handle user authentication, login, logout, and status checking
 * Integrates with session-based authentication management
 */
export const registerAuthTools = (server: McpServer, sessionId?: string) => {
	// Login with email and password
	server.tool(
		'login',
		'Login to Gauzy with email and password and create a session',
		{
			email: z.string().email().describe('Email address for authentication'),
			password: z.string().min(1).describe('Password for authentication'),
			createSession: z.boolean().optional().describe('Whether to create a new session (default: true)')
		},
		async ({ email, password, createSession = true }) => {
			try {
				// Perform authentication
				const result = await apiClient.login(email, password);

				if (result.success) {
					const authStatus = authManager.getAuthStatus();
					let session: SessionData | null = null;

					// Create a new session if requested
					if (createSession && authStatus.isAuthenticated) {
						try {
							// Create session from authenticated user
							// Note: Session manager is initialized at application startup for better performance
							session = await sessionManager.createSessionFromAuth({
								metadata: {
									loginMethod: 'manual',
									loginTimestamp: new Date().toISOString(),
									userAgent: 'MCP-Server',
									source: 'auth-tools'
								},
								loginSource: 'api'
							});
						} catch (sessionError) {
							// Check if session manager is properly initialized
							if (!sessionManager.isInitialized()) {
								logger.error('Session manager not initialized at startup. This is a configuration issue.');
							} else {
								// Log other session creation errors
								logger.warn('Failed to create session after login:', sanitizeForLogging(sessionError));
							}
						}
					}

					const statusText = `✅ Login successful!

User ID: ${authStatus.userId || 'Unknown'}
Token expires: ${authStatus.tokenExpiresAt?.toISOString() || 'Unknown'}
Authentication status: ${authStatus.isAuthenticated ? 'Authenticated' : 'Not authenticated'}${session ? `\nSession ID: ${session.id}\nSession expires: ${session.expiresAt.toISOString()}` : ''}`;

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

	// Logout with session cleanup
	server.tool(
		'logout',
		'Logout from Gauzy, clear authentication tokens, and cleanup sessions',
		{
			cleanupAllSessions: z.boolean().optional().describe('Whether to cleanup all user sessions (default: true)')
		},
		async ({ cleanupAllSessions = true }) => {
			try {
				const authStatus = authManager.getAuthStatus();
				const userId = authStatus.userId;

				// Perform logout
				await apiClient.logout();

				// Cleanup sessions if user was authenticated
				let sessionsDestroyed = 0;
				if (userId && cleanupAllSessions) {
					try {
						// Cleanup all user sessions
						sessionsDestroyed = sessionManager.invalidateUserSessions(userId);
					} catch (sessionError) {
						logger.warn('Failed to cleanup sessions during logout:', sanitizeForLogging(sessionError));
					}
					// Fallback: try to destroy current session if none were invalidated
					if (sessionsDestroyed === 0 && sessionId) {
						try {
							const destroyed = sessionManager.destroySession(sessionId);
							if (destroyed) sessionsDestroyed = 1;
						} catch (sessionError) {
							logger.warn('Failed to cleanup current session during logout (fallback):', sanitizeForLogging(sessionError));
						}
					}
				} else if (sessionId) {
					try {
						// Cleanup only current session
						const destroyed = sessionManager.destroySession(sessionId);
						if (destroyed) sessionsDestroyed = 1;
					} catch (sessionError) {
						logger.warn('Failed to cleanup current session during logout:', sanitizeForLogging(sessionError));
					}
				}

				const statusText = `✅ Logout successful. Authentication tokens have been cleared.${sessionsDestroyed > 0 ? `\n🗑️  Cleaned up ${sessionsDestroyed} session(s).` : ''}`;

				return {
					content: [
						{
							type: 'text',
							text: statusText
						}
					]
				};
			} catch (error) {
				logger.error('Logout tool error:', sanitizeForLogging(error));
				return {
					content: [
						{
							type: 'text',
							text: `❌ Logout failed: ${sanitizeErrorMessage(error)}`
						}
					]
				};
			}
		}
	);

	// Get authentication and session status
	server.tool(
		'get_auth_status',
		'Get current authentication status, user information, and session details',
		{
			includeSessionInfo: z.boolean().optional().describe('Whether to include session information (default: true)')
		},
		async ({ includeSessionInfo = true }) => {
			try {
				const authStatus = authManager.getAuthStatus();
				let sessionInfo = '';
				let currentSession: SessionData | null = null;

				// Get session information if requested and user is authenticated
				if (includeSessionInfo && authStatus.userId) {
					if (!sessionManager.isInitialized()) {
						sessionInfo = '\n\n⚠️  Session manager not initialized - session information unavailable';
					} else {
						try {
							const userSessions = sessionManager.getUserSessions(authStatus.userId);
							const activeSessions = userSessions.filter(s => s.isActive);

							// Find current session if sessionId is provided and owned by current user
							if (sessionId) {
								const s = sessionManager.getSession(sessionId);
								if (s && s.userId === authStatus.userId) {
									currentSession = s;
								}
							}

							sessionInfo = `

📊 Session Information:
Active Sessions: ${activeSessions.length}
Total Sessions: ${userSessions.length}${currentSession ? `\nCurrent Session: ${currentSession.id}\nSession Expires: ${currentSession.expiresAt.toISOString()}\nSession Status: ${currentSession.isActive ? 'Active' : 'Inactive'}` : sessionId ? `\nCurrent Session: ${sessionId} (Not found, expired, or not accessible)` : ''}`;
						} catch (sessionError) {
							logger.warn('Failed to get session information:', sanitizeForLogging(sessionError));
							sessionInfo = '\n\n⚠️  Session information unavailable';
						}
					}
				}

				const statusText = `🔐 Authentication Status:

Authenticated: ${authStatus.isAuthenticated ? '✅ Yes' : '❌ No'}
Has Access Token: ${authStatus.hasToken ? '✅ Yes' : '❌ No'}
Has Refresh Token: ${authStatus.hasRefreshToken ? '✅ Yes' : '❌ No'}
User ID: ${authStatus.userId || '❌ Not available'}
Organization ID: ${authStatus.organizationId || '❌ Not available'}
Tenant ID: ${authStatus.tenantId || '❌ Not available'}
Token Expires: ${authStatus.tokenExpiresAt?.toISOString() || '❌ Not available'}${sessionInfo}

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
		}
	);

	// Refresh authentication token with session context
	server.tool(
		'refresh_auth_token',
		'Manually refresh the authentication token and update session context',
		{
			updateSessionActivity: z.boolean().optional().describe('Whether to update session activity (default: true)')
		},
		async ({ updateSessionActivity = true }) => {
			try {
				const success = await authManager.refreshToken();

				if (success) {
					const authStatus = authManager.getAuthStatus();
					let sessionUpdateInfo = '';

					// Update session activity if requested and session exists
					if (updateSessionActivity && sessionId) {
						try {
							const updated = sessionManager.updateSessionActivity(
								sessionId,
								{
									tokenRefreshed: new Date().toISOString(),
									newTokenExpiry: authStatus.tokenExpiresAt?.toISOString()
								},
								900 // extend TTL by 15 minutes (optional; consider making configurable)
							);
							if (updated) {
								sessionUpdateInfo = '\n🔄 Session activity updated';
							}
						} catch (sessionError) {
							logger.warn('Failed to update session activity after token refresh:', sanitizeForLogging(sessionError));
						}
					}

					return {
						content: [
							{
								type: 'text',
								text: `✅ Token refreshed successfully!

New token expires: ${authStatus.tokenExpiresAt?.toISOString() || 'Unknown'}
Authentication status: ${authStatus.isAuthenticated ? 'Authenticated' : 'Not authenticated'}${sessionUpdateInfo}`
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
		}
	);

	// Session management tools
	server.tool(
		'get_session_info',
		'Get detailed information about current or user sessions',
		{
			targetSessionId: z.string().optional().describe('Specific session ID to query (default: current session)'),
			includeConnections: z.boolean().optional().describe('Whether to include connection details (default: false)')
		},
		async ({ targetSessionId, includeConnections = false }) => {
			try {
				const authStatus = authManager.getAuthStatus();
				if (!authStatus.userId) {
					return {
						content: [
							{
								type: 'text',
								text: '❌ No authenticated user found. Please login first.'
							}
						]
					};
				}

				const querySessionId = targetSessionId || sessionId;
				let sessionDetails = '';
				let connectionDetails = '';

				if (querySessionId) {
					const session = sessionManager.getSession(querySessionId);
					if (session && session.userId === authStatus.userId) {
						sessionDetails = `
🎯 Session Details:
Session ID: ${session.id}
User ID: ${session.userId}
User Email: ${session.userEmail || 'Not available'}
Organization ID: ${session.organizationId || 'Not available'}
Tenant ID: ${session.tenantId || 'Not available'}
Created: ${session.created.toISOString()}
Last Activity: ${session.lastActivity.toISOString()}
Expires: ${session.expiresAt.toISOString()}
Status: ${session.isActive ? 'Active' : 'Inactive'}
Login Source: ${session.loginSource}
Connections: ${session.connectionIds.size}`;

						if (includeConnections && session.connectionIds.size > 0) {
							const connections = sessionManager.getSessionConnections(querySessionId);
							connectionDetails = connections.map(conn =>
								`  - ${conn.id} (${conn.type}) - ${conn.isActive ? 'Active' : 'Inactive'} - Last seen: ${conn.lastSeen?.toISOString?.() || 'Unknown'}`
							).join('\n');
							if (connectionDetails) {
								connectionDetails = `\n\n🔗 Connections:\n${connectionDetails}`;
							}
						}
					} else {
						sessionDetails = `\n❌ Session ${querySessionId} not found, expired, or not accessible`;
					}
				}

				// Get user's all sessions
				const userSessions = sessionManager.getUserSessions(authStatus.userId);
				const activeSessions = userSessions.filter(s => s.isActive);

				const summaryText = `📊 Session Summary:
Total Sessions: ${userSessions.length}
Active Sessions: ${activeSessions.length}
Current Session: ${sessionId ? 'Present' : 'Not in session context'}`;

				return {
					content: [
						{
							type: 'text',
							text: `${summaryText}${sessionDetails}${connectionDetails}`
						}
					]
				};
			} catch (error) {
				logger.error('Session info tool error:', sanitizeForLogging(error));
				return {
					content: [
						{
							type: 'text',
							text: `❌ Failed to get session information: ${sanitizeErrorMessage(error)}`
						}
					]
				};
			}
		}
	);

	// Session cleanup tool
	server.tool(
		'cleanup_sessions',
		'Cleanup expired sessions and get session statistics',
		{},
		async () => {
			try {
				const cleanupResult = sessionManager.cleanup();
				const stats = sessionManager.getStats();

				const statusText = `🧹 Session Cleanup Completed:

Sessions Removed: ${cleanupResult.sessionsRemoved}
Connections Removed: ${cleanupResult.connectionsRemoved}

📊 Current Statistics:
Total Sessions: ${stats.totalSessions}
Active Sessions: ${stats.activeSessions}
Expired Sessions: ${stats.expiredSessions}
Total Connections: ${stats.totalConnections}
Active Connections: ${stats.activeConnections}`;

				return {
					content: [
						{
							type: 'text',
							text: statusText
						}
					]
				};
			} catch (error) {
				logger.error('Session cleanup tool error:', sanitizeForLogging(error));
				return {
					content: [
						{
							type: 'text',
							text: `❌ Failed to cleanup sessions: ${sanitizeErrorMessage(error)}`
						}
					]
				};
			}
		}
	);

	logger.log('Session-aware authentication tools registered successfully');
};
