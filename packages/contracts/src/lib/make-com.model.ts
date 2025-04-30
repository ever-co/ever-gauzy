import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

// Define Make.com integration setting names
export enum MakeSettingName {
	IS_ENABLED = 'make_webhook_enabled',
	WEBHOOK_URL = 'make_webhook_url',
	ACCESS_TOKEN = 'access_token',
	REFRESH_TOKEN = 'refresh_token',
	EXPIRES_IN = 'expires_in'
}

// Define the return type for the settings
export interface IMakeComIntegrationSettings {
	isEnabled: boolean;
	webhookUrl: string | null;
}

// OAuth related types
export interface IMakeComOAuthTokens extends IBasePerTenantAndOrganizationEntityModel {
	access_token: string;
	refresh_token: string;
	token_type: string;
	expires_in: number;
}

export interface IMakeComAuthConfig {
	clientId: string;
	clientSecret: string;
	redirectUri: string;
	postInstallUrl: string;
}

export type grantType = 'authorization_code' | 'refresh_token';

export interface IMakeComCreateIntegration extends IBasePerTenantAndOrganizationEntityModel {
	client_id: string;
	code: string;
	grant_type: grantType;
	redirect_uri: string;
	client_secret: string;
}
export interface IMakeComOAuthCodeExchange {
	code: string;
	state?: string;
}
