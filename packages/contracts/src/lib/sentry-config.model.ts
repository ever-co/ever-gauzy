export interface ISentryConfig {
	sentry_dsn?: string;
	sentry_enabled?: boolean;
	sentry_environment?: string;
	sentry_debug?: boolean;
}

export const SENTRY_CONFIG_KEYS = ['sentry_dsn', 'sentry_enabled', 'sentry_environment', 'sentry_debug'] as const;

export type SentryConfigKey = (typeof SENTRY_CONFIG_KEYS)[number];
