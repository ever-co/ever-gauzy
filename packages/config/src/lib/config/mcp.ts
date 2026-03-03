import { registerAs } from '@nestjs/config';

/**
 * MCP Server Configuration
 *
 * Defines configuration settings for the MCP (Model Context Protocol) server
 * using the @nestjs/config library. These values can be overridden per platform
 * via environment variables.
 *
 * Note: Transport-specific settings (port, host, websocket, etc.) are managed by
 * the MCP server's own environment files at packages/mcp-server/src/lib/environments/.
 * This config provides app-level identity used by NestJS modules.
 *
 * @returns An object representing the MCP server configuration.
 */
export default registerAs('mcp', () => ({
	/**
	 * The name of the MCP server application.
	 * Override via MCP_APP_NAME to customize for different platforms.
	 */
	app_name: process.env.MCP_APP_NAME || 'Gauzy MCP Server',

	/**
	 * The unique application identifier for the MCP server.
	 * Override via MCP_APP_ID to customize for different platforms.
	 */
	app_id: process.env.MCP_APP_ID || 'co.gauzy.mcp-server',

	/**
	 * Whether debug mode is enabled.
	 */
	debug: process.env.GAUZY_MCP_DEBUG === 'true'
}));
