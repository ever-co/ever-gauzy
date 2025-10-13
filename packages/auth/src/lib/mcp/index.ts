/**
 * MCP OAuth 2.0 Authorization Server
 *
 * This module implements a complete OAuth 2.0 authorization server
 * specifically designed for MCP (Model Context Protocol) integrations.
 *
 * It provides:
 * - OAuth 2.0 authorization code flow with PKCE
 * - Client credentials grant
 * - Refresh token support
 * - JWT-based access tokens
 * - User authentication and consent management
 *
 * Note: User authentication is handled by UserService in @gauzy/core
 * to avoid circular dependencies.
 *
 * @module @gauzy/auth
 */

// Server components
export * from './server';

// Utilities
export * from './utils';

// Interfaces
export * from './interfaces';
