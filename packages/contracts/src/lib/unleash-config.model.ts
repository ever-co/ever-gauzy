export interface IUnleashConfig {
	unleash_api_url?: string;
	unleash_app_name?: string;
	unleash_instance_id?: string;
	unleash_api_key?: string;
	unleash_refresh_interval?: number;
	unleash_metrics_interval?: number;
}

export const UNLEASH_CONFIG_KEYS = [
	'unleash_api_url',
	'unleash_app_name',
	'unleash_instance_id',
	'unleash_api_key',
	'unleash_refresh_interval',
	'unleash_metrics_interval'
] as const;

export type UnleashConfigKey = (typeof UNLEASH_CONFIG_KEYS)[number];
