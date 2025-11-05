/**
 * MCP OAuth 2.0 Authorization Server
 *
 * This module implements a complete OAuth 2.0 authorization server
 *
 * It provides:
 * - OAuth 2.0 authorization code flow with PKCE
 * - Client credentials grant
 * - Refresh token support
 * - JWT-based access tokens
 * - User authentication and consent management
 *
 * @module @gauzy/auth
 */

// Server components
export * from './server';

// Utilities
export * from './utils';

// Interfaces
export * from './interfaces';
