import { ISystemSettingMetadata, SystemSettingScope } from '@gauzy/contracts';

/**
 * Metadata definitions for all system settings.
 * Defines which scopes are allowed, default values, and other properties for each setting.
 */
export const SYSTEM_SETTINGS_METADATA: ISystemSettingMetadata[] = [
	// Sentry settings - Global/Tenant only (startup-time configuration)
	{
		key: 'sentry_dsn',
		envVar: 'SENTRY_DSN',
		allowedScopes: [SystemSettingScope.GLOBAL, SystemSettingScope.TENANT],
		isSecret: true,
		type: 'string'
	},
	{
		key: 'sentry_enabled',
		envVar: 'SENTRY_ENABLED',
		defaultValue: false,
		allowedScopes: [SystemSettingScope.GLOBAL, SystemSettingScope.TENANT],
		type: 'boolean'
	},
	{
		key: 'sentry_environment',
		envVar: 'SENTRY_ENVIRONMENT',
		allowedScopes: [SystemSettingScope.GLOBAL, SystemSettingScope.TENANT],
		type: 'string'
	},
	{
		key: 'sentry_debug',
		envVar: 'SENTRY_DEBUG',
		defaultValue: false,
		allowedScopes: [SystemSettingScope.GLOBAL, SystemSettingScope.TENANT],
		type: 'boolean'
	},

	// Unleash settings - Global/Tenant only (startup-time configuration)
	{
		key: 'unleash_api_url',
		envVar: 'UNLEASH_API_URL',
		allowedScopes: [SystemSettingScope.GLOBAL, SystemSettingScope.TENANT],
		type: 'string'
	},
	{
		key: 'unleash_app_name',
		envVar: 'UNLEASH_APP_NAME',
		defaultValue: 'Gauzy',
		allowedScopes: [SystemSettingScope.GLOBAL, SystemSettingScope.TENANT],
		type: 'string'
	},
	{
		key: 'unleash_instance_id',
		envVar: 'UNLEASH_INSTANCE_ID',
		allowedScopes: [SystemSettingScope.GLOBAL, SystemSettingScope.TENANT],
		type: 'string'
	},
	{
		key: 'unleash_api_key',
		envVar: 'UNLEASH_API_KEY',
		allowedScopes: [SystemSettingScope.GLOBAL, SystemSettingScope.TENANT],
		isSecret: true,
		type: 'string'
	},
	{
		key: 'unleash_refresh_interval',
		envVar: 'UNLEASH_REFRESH_INTERVAL',
		defaultValue: 15000,
		allowedScopes: [SystemSettingScope.GLOBAL, SystemSettingScope.TENANT],
		type: 'number'
	},
	{
		key: 'unleash_metrics_interval',
		envVar: 'UNLEASH_METRICS_INTERVAL',
		defaultValue: 60000,
		allowedScopes: [SystemSettingScope.GLOBAL, SystemSettingScope.TENANT],
		type: 'number'
	},

	// Google Maps - Can be different per Organization
	{
		key: 'google_maps_api_key',
		envVar: 'GOOGLE_MAPS_API_KEY',
		allowedScopes: [SystemSettingScope.GLOBAL, SystemSettingScope.TENANT, SystemSettingScope.ORGANIZATION],
		isSecret: true,
		type: 'string'
	},

	// PostHog settings - Global/Tenant only (startup-time configuration)
	{
		key: 'posthog_api_key',
		envVar: 'POSTHOG_KEY',
		allowedScopes: [SystemSettingScope.GLOBAL, SystemSettingScope.TENANT],
		isSecret: true,
		type: 'string'
	},
	{
		key: 'posthog_api_host',
		envVar: 'POSTHOG_HOST',
		defaultValue: 'https://app.posthog.com',
		allowedScopes: [SystemSettingScope.GLOBAL, SystemSettingScope.TENANT],
		type: 'string'
	},
	{
		key: 'posthog_enabled',
		envVar: 'POSTHOG_ENABLED',
		defaultValue: false,
		allowedScopes: [SystemSettingScope.GLOBAL, SystemSettingScope.TENANT],
		type: 'boolean'
	},
	{
		key: 'posthog_flush_interval',
		envVar: 'POSTHOG_FLUSH_INTERVAL',
		defaultValue: 10000,
		allowedScopes: [SystemSettingScope.GLOBAL, SystemSettingScope.TENANT],
		type: 'number'
	},

	// Jitsu settings - Global/Tenant only (startup-time configuration)
	{
		key: 'jitsu_server_url',
		envVar: 'JITSU_SERVER_URL',
		allowedScopes: [SystemSettingScope.GLOBAL, SystemSettingScope.TENANT],
		type: 'string'
	},
	{
		key: 'jitsu_server_write_key',
		envVar: 'JITSU_SERVER_WRITE_KEY',
		allowedScopes: [SystemSettingScope.GLOBAL, SystemSettingScope.TENANT],
		isSecret: true,
		type: 'string'
	},
	{
		key: 'jitsu_server_debug',
		envVar: 'JITSU_SERVER_DEBUG',
		defaultValue: false,
		allowedScopes: [SystemSettingScope.GLOBAL, SystemSettingScope.TENANT],
		type: 'boolean'
	},
	{
		key: 'jitsu_server_echo_events',
		envVar: 'JITSU_SERVER_ECHO_EVENTS',
		defaultValue: false,
		allowedScopes: [SystemSettingScope.GLOBAL, SystemSettingScope.TENANT],
		type: 'boolean'
	},

	// Gauzy AI settings - Can be different per Organization
	{
		key: 'gauzy_ai_graphql_endpoint',
		envVar: 'GAUZY_AI_GRAPHQL_ENDPOINT',
		allowedScopes: [SystemSettingScope.GLOBAL, SystemSettingScope.TENANT, SystemSettingScope.ORGANIZATION],
		type: 'string'
	},
	{
		key: 'gauzy_ai_rest_endpoint',
		envVar: 'GAUZY_AI_REST_ENDPOINT',
		allowedScopes: [SystemSettingScope.GLOBAL, SystemSettingScope.TENANT, SystemSettingScope.ORGANIZATION],
		type: 'string'
	},
	{
		key: 'gauzy_ai_api_key',
		envVar: 'GAUZY_AI_API_KEY',
		allowedScopes: [SystemSettingScope.GLOBAL, SystemSettingScope.TENANT, SystemSettingScope.ORGANIZATION],
		isSecret: true,
		type: 'string'
	},

	// Cloudinary settings - Global/Tenant only
	{
		key: 'cloudinary_cloud_name',
		envVar: 'CLOUDINARY_CLOUD_NAME',
		allowedScopes: [SystemSettingScope.GLOBAL, SystemSettingScope.TENANT],
		type: 'string'
	},
	{
		key: 'cloudinary_api_key',
		envVar: 'CLOUDINARY_API_KEY',
		allowedScopes: [SystemSettingScope.GLOBAL, SystemSettingScope.TENANT],
		isSecret: true,
		type: 'string'
	},
	{
		key: 'cloudinary_api_secret',
		envVar: 'CLOUDINARY_API_SECRET',
		allowedScopes: [SystemSettingScope.GLOBAL, SystemSettingScope.TENANT],
		isSecret: true,
		type: 'string'
	},
	{
		key: 'cloudinary_cdn_url',
		envVar: 'CLOUDINARY_CDN_URL',
		defaultValue: 'https://res.cloudinary.com',
		allowedScopes: [SystemSettingScope.GLOBAL, SystemSettingScope.TENANT],
		type: 'string'
	},

	// Chatwoot settings - Can be different per Organization
	{
		key: 'chatwoot_sdk_token',
		envVar: 'CHATWOOT_SDK_TOKEN',
		allowedScopes: [SystemSettingScope.GLOBAL, SystemSettingScope.TENANT, SystemSettingScope.ORGANIZATION],
		isSecret: true,
		type: 'string'
	}
];

/**
 * Get metadata for a specific setting key.
 */
export function getSettingMetadata(key: string): ISystemSettingMetadata | undefined {
	return SYSTEM_SETTINGS_METADATA.find((m) => m.key === key);
}

/**
 * Get the environment variable name for a setting key.
 */
export function getEnvVarName(key: string): string | undefined {
	return getSettingMetadata(key)?.envVar;
}

/**
 * Get the default value for a setting key.
 */
export function getDefaultValue(key: string): any {
	return getSettingMetadata(key)?.defaultValue;
}

/**
 * Check if a setting is allowed at a specific scope.
 */
export function isSettingAllowedAtScope(key: string, scope: SystemSettingScope): boolean {
	const metadata = getSettingMetadata(key);
	// If no metadata defined, allow at all scopes (for flexibility)
	if (!metadata) {
		return true;
	}
	return metadata.allowedScopes.includes(scope);
}
