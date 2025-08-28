import { environment } from '../environments/environment';

export type McpTransportType = 'stdio' | 'http' | 'websocket' | 'auto';

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
		trustedProxies?: string[];
	};
	websocket?: {
		port: number;
		host: string;
		path?: string;
		/** Global compression enable/disable - controls overall compression capability */
		compression?: boolean;
		/** Per-message deflate extension - enables compression on individual messages when compression is enabled */
		perMessageDeflate?: boolean;
		maxPayload?: number;
		allowedOrigins?: string[];
		tls?: boolean;
		cert?: string;
		key?: string;
		session?: {
			enabled: boolean;
			cookieName: string;
		};
		trustedProxies?: string[];
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
			type: (() => {
				const t = (process.env.MCP_TRANSPORT || '').toLowerCase();
				return t === 'stdio' || t === 'http' || t === 'websocket' || t === 'auto' ? (t as McpTransportType) : 'stdio';
			})(),
			http: {
				port: (() => {
					const p = Number.parseInt(process.env.MCP_HTTP_PORT ?? '3001', 10);
					return Number.isInteger(p) && p >= 0 && p <= 65535 ? p : 3001;
				})(),
				host: process.env.MCP_HTTP_HOST || '127.0.0.1',
				cors: {
					origin: (() => {
						if (process.env.MCP_CORS_ORIGIN) {
							return process.env.MCP_CORS_ORIGIN.split(',').map(o => o.trim()).filter(o => o.length > 0);
						}

						// Only allow localhost defaults in development
						if (process.env.NODE_ENV === 'production') {
							throw new Error(
								'MCP_CORS_ORIGIN environment variable is required in production. ' +
								'Please set it to explicitly define allowed origins (e.g., MCP_CORS_ORIGIN=https://your-domain.com)'
							);
						}

						// Development fallback
						return ['http://localhost:3000', 'http://localhost:4200', 'http://127.0.0.1:3000', 'http://127.0.0.1:4200'];
					})(),
					credentials: process.env.MCP_CORS_CREDENTIALS !== 'false'
				},
				session: {
					enabled: process.env.MCP_SESSION_ENABLED !== 'false',
					cookieName: process.env.MCP_SESSION_COOKIE_NAME || 'mcp-session-id'
				},
				trustedProxies: process.env.MCP_TRUSTED_PROXIES ? process.env.MCP_TRUSTED_PROXIES.split(',').map(p => p.trim()).filter(p => p.length > 0) : []
			},
			websocket: {
				port: (() => {
					const p = Number.parseInt(process.env.MCP_WS_PORT ?? '3002', 10);
					return Number.isInteger(p) && p >= 0 && p <= 65535 ? p : 3002;
				})(),
				host: process.env.MCP_WS_HOST || '127.0.0.1', // Default to localhost, prefer TLS termination at reverse proxy
				path: process.env.MCP_WS_PATH || '/',
				compression: process.env.MCP_WS_COMPRESSION !== 'false',
				perMessageDeflate: process.env.MCP_WS_PER_MESSAGE_DEFLATE !== 'false', // Separate env var for per-message deflate
				maxPayload: (() => {
					const size = Number.parseInt(process.env.MCP_WS_MAX_PAYLOAD ?? '16777216', 10); // 16MB default
					return Number.isInteger(size) && size > 0 ? size : 16777216;
				})(),
				allowedOrigins: (() => {
					if (process.env.MCP_WS_ALLOWED_ORIGINS) {
						return process.env.MCP_WS_ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(o => o.length > 0);
					}

					// Enforce origin validation in production
					if (process.env.NODE_ENV === 'production') {
						throw new Error(
							'MCP_WS_ALLOWED_ORIGINS environment variable is required in production. ' +
							'Please set it to explicitly define allowed origins (e.g., MCP_WS_ALLOWED_ORIGINS=https://your-domain.com,wss://your-domain.com)'
						);
					}

					// Development fallback - allow common development origins
					const developmentOrigins = [
						'http://localhost:3000',
						'http://localhost:4200',
						'http://127.0.0.1:3000',
						'http://127.0.0.1:4200'
					];
					return developmentOrigins;
				})(),
				tls: process.env.MCP_WS_TLS === 'true',
				cert: process.env.MCP_WS_CERT_PATH,
				key: process.env.MCP_WS_KEY_PATH,
				session: {
					enabled: process.env.MCP_WS_SESSION_ENABLED !== 'false',
					cookieName: process.env.MCP_WS_SESSION_COOKIE_NAME || 'mcp-ws-session-id'
				},
				trustedProxies: process.env.MCP_WS_TRUSTED_PROXIES ? process.env.MCP_WS_TRUSTED_PROXIES.split(',').map(p => p.trim()).filter(p => p.length > 0) : []
			}
		}
	}
};
