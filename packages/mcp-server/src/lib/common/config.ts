import { environment } from '../environments/environment';

export type McpTransportType = 'stdio' | 'http' | 'auto';

export interface McpTransportConfig {
	type: McpTransportType;
	http?: {
		port: number;
		host: string;
		cors: {
			origin: string[] | string | boolean;
			credentials: boolean;
		};
		session: {
			enabled: boolean;
			cookieName: string;
		};
	};
}

export interface GauzyConfig {
	baseUrl: string;
	debug: boolean;
	auth: {
		email?: string;
		password?: string;
		autoLogin: boolean;
	};
	mcp: {
		transport: McpTransportConfig;
	};
}

export const config: GauzyConfig = {
	baseUrl: environment.baseUrl,
	debug: environment.debug,
	auth: environment.auth,
	mcp: {
		transport: {
			type: (process.env.MCP_TRANSPORT as McpTransportType) || 'stdio',
			http: {
				port: parseInt(process.env.MCP_HTTP_PORT || '3001', 10) || 3001,
				host: process.env.MCP_HTTP_HOST || 'localhost',
				cors: {
					origin: process.env.MCP_CORS_ORIGIN 
						? process.env.MCP_CORS_ORIGIN.split(',').map(o => o.trim()).filter(o => o.length > 0)
						: ['http://localhost:3000', 'http://localhost:4200', 'http://127.0.0.1:3000', 'http://127.0.0.1:4200'],
					credentials: process.env.MCP_CORS_CREDENTIALS !== 'false'
				},
				session: {
					enabled: process.env.MCP_SESSION_ENABLED !== 'false',
					cookieName: process.env.MCP_SESSION_COOKIE_NAME || 'mcp-session-id'
				}
			}
		}
	}
};
