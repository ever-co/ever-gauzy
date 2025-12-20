/**
 * Configuration Manager
 *
 * Centralized configuration management following DRY principle
 * Provides consistent configuration parsing and validation
 */

import { AuthorizationConfig, DEFAULT_AUTHORIZATION_CONFIG, AUTH_ENV_KEYS } from '../interfaces/authorization-config';
import { OAuth2ServerConfig } from '../server/oauth-authorization-server';
import { SecurityLogger } from './security-logger';
const DEFAULT_SESSION_SECRET = 'your-session-secret-key';

export interface ServerConfig {
	// Server basic settings
	host: string;
	port: number;
	mcpAuthUrl: string;
	baseUrl: string;
	environment: 'development' | 'production' | 'stage';

	// Security settings
	sessionSecret: string;
	corsOrigins: string[];
	trustedProxies: string[];

	// Rate limiting
	rateLimitEnabled: boolean;
	rateLimitTtl: number;
	rateLimitMax: number;

	// Redis settings
	redisUrl?: string;

	// OAuth 2.0 settings
	oauth: AuthorizationConfig;
}

export class ConfigManager {
	private static instance: ConfigManager;
	private config: ServerConfig;
	private securityLogger: SecurityLogger;

	private constructor() {
		this.securityLogger = new SecurityLogger();
		this.config = this.loadConfiguration();
	}

	private normalizeBaseUrl(url: string): string {
		return url.replace(/\/+$/, '');
	}

	private normalizeAuthUrl(url: string): string {
		return url.replace(/\/+$/, '');
	}

	private deepClone<T>(obj: T): T {
		try {
			// Node 18+ / modern runtimes
			return structuredClone(obj);
		} catch {
			// Plain data only; safe here
			return JSON.parse(JSON.stringify(obj));
		}
	}

	private getEnvEnvironment(key: string, defaultEnv: ServerConfig['environment']): ServerConfig['environment'] {
		const rawValue = process.env[key];

		if (!rawValue || rawValue.trim() === '') {
			return defaultEnv;
		}

		// Normalize: trim whitespace and convert to lowercase
		const normalizedValue = rawValue.trim().toLowerCase();

		// Explicitly handle each valid environment with common variations
		switch (normalizedValue) {
			case 'production':
				return 'production';

			// Development environment (local)
			case 'development':
				return 'development';

			case 'stage':
				this.securityLogger.info(`${key}="${rawValue}" detected. Treating staging as production environment.`);
				return 'production';

			default:
				this.securityLogger.warn(
					`Unexpected ${key} value: "${rawValue}". Valid values: production, development, stage. Defaulting to "${defaultEnv}".`
				);
				return defaultEnv;
		}
	}

	static getInstance(): ConfigManager {
		if (!ConfigManager.instance) {
			ConfigManager.instance = new ConfigManager();
		}
		return ConfigManager.instance;
	}

	/**
	 * Get the current configuration
	 */
	getConfig(): ServerConfig {
		return this.deepClone(this.config);
	}

	/**
	 * Get OAuth configuration
	 */
	getOAuthConfig(): AuthorizationConfig {
		return this.deepClone(this.config.oauth);
	}

	/**
	 * Get OAuth server configuration for embedded server
	 */
	getOAuthServerConfig(): OAuth2ServerConfig {
		const baseUrl = this.normalizeBaseUrl(this.config.baseUrl);
		const authUrl = this.normalizeAuthUrl(this.config.mcpAuthUrl);
		return {
			issuer: authUrl,
			baseUrl,
			audience: this.config.oauth.resourceUri,
			enableClientRegistration: this.config.environment === 'development',
			authorizationEndpoint: `${authUrl}/oauth2/authorize`,
			tokenEndpoint: `${authUrl}/oauth2/token`,
			jwksEndpoint: `${authUrl}/.well-known/jwks.json`,
			registrationEndpoint: `${authUrl}/oauth2/register`,
			introspectionEndpoint: `${authUrl}/oauth2/introspect`,
			userInfoEndpoint: `${authUrl}/oauth2/userinfo`,
			loginEndpoint: `${authUrl}/oauth2/login`,
			sessionSecret: this.config.sessionSecret,
			redisUrl: this.config.redisUrl
		};
	}

	/**
	 * Load configuration from environment variables with validation
	 */
	private loadConfiguration(): ServerConfig {
		const config: ServerConfig = {
			// Basic server settings
			host: this.getEnvString('MCP_HTTP_HOST', 'localhost'),
			port: this.getEnvNumber('MCP_HTTP_PORT', 3001),
			mcpAuthUrl: this.getEnvString('MCP_AUTH_JWT_ISSUER', 'http://localhost:3003'),
			baseUrl: this.getEnvString('MCP_AUTH_BASE_URL', 'http://localhost:3003'),
			environment: this.getEnvEnvironment('NODE_ENV', 'development'),

			// Security settings
			sessionSecret: this.getRequiredEnvString('MCP_AUTH_SESSION_SECRET', DEFAULT_SESSION_SECRET),
			corsOrigins: this.parseStringArray(
				this.getEnvString('MCP_CORS_ORIGINS', this.getEnvString('MCP_CORS_ORIGIN', ''))
			),
			trustedProxies: this.parseStringArray(this.getEnvString('MCP_TRUSTED_PROXIES', '')),

			// Rate limiting
			rateLimitEnabled: this.getEnvBoolean('MCP_RATE_LIMIT_ENABLED', true),
			rateLimitTtl: this.getEnvNumber('MCP_RATE_LIMIT_TTL', 60000), // 1 minute
			rateLimitMax: this.getEnvNumber('MCP_RATE_LIMIT_MAX', 100),

			// Redis - construct URL from REDIS_URL or individual parameters
			redisUrl: (() => {
				if (process.env.REDIS_ENABLED !== 'true') {
					console.log('Redis is not enabled for MCP.');
					return undefined;
				}

				const { REDIS_URL, REDIS_HOST, REDIS_PORT, REDIS_USER, REDIS_PASSWORD, REDIS_TLS } = process.env;

				// If REDIS_URL is provided, use it directly
				if (REDIS_URL) {
					return REDIS_URL;
				}

				// If individual parameters are provided, construct the URL
				if (REDIS_HOST && REDIS_PORT) {
					const redisProtocol = REDIS_TLS === 'true' ? 'rediss' : 'redis';
					const auth = REDIS_USER && REDIS_PASSWORD ? `${REDIS_USER}:${REDIS_PASSWORD}@` : '';
					return `${redisProtocol}://${auth}${REDIS_HOST}:${REDIS_PORT}`;
				}

				// If neither REDIS_URL nor required individual parameters are provided, log warning
				console.warn(
					'Redis is enabled but neither REDIS_URL nor REDIS_HOST/REDIS_PORT are configured. Redis will not be used.'
				);
				return undefined;
			})(),

			// OAuth 2.0
			oauth: this.loadOAuthConfiguration()
		};

		this.validateConfiguration(config);
		return Object.freeze(config) as ServerConfig;
	}

	/**
	 * Load OAuth 2.0 configuration with defaults
	 */
	private loadOAuthConfiguration(): AuthorizationConfig {
		const config: AuthorizationConfig = {
			...DEFAULT_AUTHORIZATION_CONFIG,
			enabled: this.getEnvBoolean(AUTH_ENV_KEYS.ENABLED, false),
			resourceUri: this.getEnvString(AUTH_ENV_KEYS.RESOURCE_URI, ''),
			authorizationServers: [],
		};

		// Parse authorization servers
		const serversEnv = this.getEnvString(AUTH_ENV_KEYS.AUTHORIZATION_SERVERS);
		if (serversEnv) {
			try {
				const parsed = JSON.parse(serversEnv);
				if (!Array.isArray(parsed)) {
					throw new Error('MCP_AUTH_SERVERS must be a JSON array');
				}
				config.authorizationServers = parsed;
			} catch (error) {
				this.securityLogger.warn('Failed to parse authorization servers configuration', {
					error,
					invalidJson: serversEnv
				});
			}
		}

		// Parse required scopes
		const scopesEnv = this.getEnvString(AUTH_ENV_KEYS.REQUIRED_SCOPES);
		if (scopesEnv) {
			config.requiredScopes = this.parseStringArray(scopesEnv);
		}

		// JWT configuration
		if (config.jwt) {
			config.jwt.audience = this.getEnvString(AUTH_ENV_KEYS.JWT_AUDIENCE);
			config.jwt.issuer = this.getEnvString(AUTH_ENV_KEYS.JWT_ISSUER);
			config.jwt.publicKey = this.getEnvString(AUTH_ENV_KEYS.JWT_PUBLIC_KEY);
			config.jwt.jwksUri = this.getEnvString(AUTH_ENV_KEYS.JWT_JWKS_URI);

			const algorithmsEnv = this.getEnvString(AUTH_ENV_KEYS.JWT_ALGORITHMS);
			if (algorithmsEnv) {
				config.jwt.algorithms = this.parseStringArray(algorithmsEnv);
			}
		}

		// Introspection configuration
		const introspectionEndpoint = this.getEnvString(AUTH_ENV_KEYS.INTROSPECTION_ENDPOINT);
		const introspectionClientId = this.getEnvString(AUTH_ENV_KEYS.INTROSPECTION_CLIENT_ID);
		const introspectionClientSecret = this.getEnvString(AUTH_ENV_KEYS.INTROSPECTION_CLIENT_SECRET);

		if (introspectionEndpoint && introspectionClientId && introspectionClientSecret) {
			config.introspection = {
				endpoint: introspectionEndpoint,
				clientId: introspectionClientId,
				clientSecret: introspectionClientSecret
			};
		}

		// Cache configuration
		if (config.cache) {
			config.cache.tokenTtl = this.getEnvNumber(AUTH_ENV_KEYS.TOKEN_CACHE_TTL, config.cache.tokenTtl);
			config.cache.metadataTtl = this.getEnvNumber(AUTH_ENV_KEYS.METADATA_CACHE_TTL, config.cache.metadataTtl);
		}

		return config;
	}

	/**
	 * Validate configuration for common issues
	 */
	private validateConfiguration(config: ServerConfig): void {
		const errors: string[] = [];

		// Validate base URL format
		if (config.baseUrl) {
			try {
				const u = new URL(config.baseUrl);
				if (config.environment === 'production' && u.protocol !== 'https:') {
					errors.push('MCP_AUTH_BASE_URL must use https in production');
				}
			} catch {
				errors.push('MCP_AUTH_BASE_URL must be a valid URL');
			}
		}

		// Validate port range
		if (config.port < 1 || config.port > 65535) {
			errors.push('MCP_PORT must be between 1 and 65535');
		}

		// Validate OAuth configuration if enabled
		if (config.oauth.enabled) {
			if (!config.oauth.resourceUri) {
				errors.push('MCP_AUTH_RESOURCE_URI is required when OAuth is enabled');
			}

			const hasIntrospection = !!config.oauth.introspection;
			const hasJwtKeys = !!(config.oauth.jwt && (config.oauth.jwt.jwksUri || config.oauth.jwt.publicKey));

			if (config.oauth.authorizationServers.length === 0 && !hasIntrospection) {
				errors.push(
					'At least one authorization server or token introspection must be configured when OAuth is enabled'
				);
			}

			if (!hasJwtKeys && !hasIntrospection) {
				errors.push(
					'Either MCP_AUTH_JWT_JWKS_URI or MCP_AUTH_JWT_PUBLIC_KEY must be set for JWT validation, or MCP_AUTH_INTROSPECTION_* must be configured'
				);
			}
		}

		// Validate session secret in production
		if (config.environment === 'production' && config.sessionSecret === DEFAULT_SESSION_SECRET) {
			errors.push('MCP_AUTH_SESSION_SECRET must be set to a secure value in production');
		}

		if (errors.length > 0) {
			this.securityLogger.error('Configuration validation failed', { errors });
			throw new Error(`Configuration errors: ${errors.join(', ')}`);
		}

		this.securityLogger.debug('Configuration validated successfully', {
			environment: config.environment,
			oauthEnabled: config.oauth.enabled,
			port: config.port
		});
	}

	/**
	 * Helper methods for environment variable parsing
	 */
	private getEnvString(key: string, defaultValue?: string): string | undefined {
		return process.env[key] || defaultValue;
	}

	private getRequiredEnvString(key: string, fallback: string): string {
		const value = process.env[key];
		if (!value) {
			if (this.getEnvEnvironment('NODE_ENV', 'development') === 'production') {
				this.securityLogger.error(`Environment variable ${key} not set, using fallback value`);
			} else {
				this.securityLogger.warn(`Environment variable ${key} not set, using fallback value`);
			}
			return fallback;
		}
		return value;
	}

	private getEnvNumber(key: string, defaultValue?: number): number | undefined {
		const value = process.env[key];
		if (!value) return defaultValue;

		const parsed = parseInt(value, 10);
		if (isNaN(parsed)) {
			this.securityLogger.warn(`Invalid number value for ${key}: ${value}, using default: ${defaultValue}`);
			return defaultValue;
		}

		return parsed;
	}

	private getEnvBoolean(key: string, defaultValue?: boolean): boolean | undefined {
		const value = process.env[key];
		if (!value) return defaultValue;

		return value.toLowerCase() === 'true' || value === '1';
	}

	private parseStringArray(value: string): string[] {
		if (!value) return [];
		return value
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);
	}
}
