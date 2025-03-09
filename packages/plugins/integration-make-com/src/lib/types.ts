// Define Make.com integration setting names
export enum MakeSettingName {
	IS_ENABLED = 'make_webhook_enabled',
	WEBHOOK_URL = 'make_webhook_url'
}

// Define the return type for the settings
export interface IMakeComIntegrationSettings {
	isEnabled: boolean;
	webhookUrl: string | null;
}
