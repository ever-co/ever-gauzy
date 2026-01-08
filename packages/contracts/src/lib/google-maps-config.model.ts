export interface IGoogleMapsConfig {
	google_maps_api_key?: string;
}

export const GOOGLE_MAPS_CONFIG_KEYS = ['google_maps_api_key'] as const;

export type GoogleMapsConfigKey = (typeof GOOGLE_MAPS_CONFIG_KEYS)[number];
