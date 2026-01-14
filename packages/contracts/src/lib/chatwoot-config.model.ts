export interface IChatwootConfig {
	chatwoot_sdk_token?: string;
}

export const CHATWOOT_CONFIG_KEYS = ['chatwoot_sdk_token'] as const;

export type ChatwootConfigKey = (typeof CHATWOOT_CONFIG_KEYS)[number];
