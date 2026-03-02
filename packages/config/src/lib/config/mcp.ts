import { registerAs } from '@nestjs/config';

/**
 * MCP Server Configuration
 *
 * Defines configuration settings for the MCP (Model Context Protocol) server
 * using the @nestjs/config library. These values can be overridden per platform
 * via environment variables.
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
	 * The transport mode for the MCP server.
	 * Options: stdio | http | websocket
	 */
	transport: process.env.MCP_TRANSPORT || 'stdio',

	/**
	 * The HTTP host for the MCP server.
	 */
	http_host: process.env.MCP_HTTP_HOST || 'localhost',

	/**
	 * The HTTP port for the MCP server.
	 */
	http_port: parseInt(process.env.MCP_HTTP_PORT, 10) || 3001,

	/**
	 * Whether debug mode is enabled.
	 */
	debug: process.env.GAUZY_MCP_DEBUG === 'true'
}));
