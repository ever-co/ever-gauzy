/**
 * Mapping of setting keys to their corresponding environment variable names.
 * Used for fallback when settings are not found in the database.
 */
export const ENV_VAR_MAPPING: Record<string, string> = {
	sentry_dsn: 'SENTRY_DSN',
	sentry_enabled: 'SENTRY_ENABLED',
	sentry_environment: 'SENTRY_ENVIRONMENT',
	sentry_debug: 'SENTRY_DEBUG',
	unleash_api_url: 'UNLEASH_API_URL',
	unleash_app_name: 'UNLEASH_APP_NAME',
	unleash_instance_id: 'UNLEASH_INSTANCE_ID',
	unleash_api_key: 'UNLEASH_API_KEY',
	unleash_refresh_interval: 'UNLEASH_REFRESH_INTERVAL',
	unleash_metrics_interval: 'UNLEASH_METRICS_INTERVAL',
	google_maps_api_key: 'GOOGLE_MAPS_API_KEY'
};

/**
 * Default values for settings when not found in DB or ENV.
 */
export const DEFAULT_VALUES: Record<string, any> = {
	sentry_enabled: false,
	sentry_debug: false,
	unleash_app_name: 'Gauzy',
	unleash_refresh_interval: 15000,
	unleash_metrics_interval: 60000
};
