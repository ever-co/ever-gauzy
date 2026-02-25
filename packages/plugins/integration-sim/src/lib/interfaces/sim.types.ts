/**
 * Setting name constants for SIM integration settings stored in IntegrationSetting.
 */
export enum SimSettingName {
	API_KEY = 'api_key',
	IS_ENABLED = 'is_enabled'
}

/**
 * Input for configuring SIM integration for a tenant.
 */
export interface IConfigureSimInput {
	apiKey: string;
	organizationId?: string;
}

/**
 * Input for executing a SIM workflow.
 */
export interface IExecuteWorkflowInput {
	workflowId: string;
	input?: any;
	timeout?: number;
	stream?: boolean;
	async?: boolean;
	triggeredBy?: 'manual' | 'event' | 'api' | 'schedule';
}

/**
 * Sanitized integration settings returned to clients (no API key exposed).
 */
export interface ISimIntegrationSettings {
	isEnabled: boolean;
	hasApiKey: boolean;
}
