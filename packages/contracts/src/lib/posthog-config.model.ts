export interface IPosthogConfig {
	posthog_api_key?: string;
	posthog_api_host?: string;
	posthog_enabled?: boolean;
	/** Flush interval in milliseconds */
	posthog_flush_interval?: number;
}

export const POSTHOG_CONFIG_KEYS = [
	'posthog_api_key',
	'posthog_api_host',
	'posthog_enabled',
	'posthog_flush_interval'
] as const;

export type PosthogConfigKey = (typeof POSTHOG_CONFIG_KEYS)[number];
