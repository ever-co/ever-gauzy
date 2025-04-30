import { IBasePerTenantAndOrganizationEntityModel } from '@gauzy/contracts';

export type GrantType = 'authorization_code' | 'refresh_token';

// Define Make.com integration setting names
export enum MakeSettingName {
	IS_ENABLED = 'make_webhook_enabled',
	WEBHOOK_URL = 'make_webhook_url',
	ACCESS_TOKEN = 'access_token',
	REFRESH_TOKEN = 'refresh_token',
	EXPIRES_IN = 'expires_in',
	TOKEN_TYPE = 'token_type'
}

// Define the return type for the settings
export interface IMakeComIntegrationSettings {
	isEnabled: boolean;
	webhookUrl: string | null;
}

// OAuth related types
/**
 * OAuth token data as returned by Make.com OAuth service.
 * Properties use snake_case to match the OAuth provider's response format.
 */
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

export interface IMakeComCreateIntegration extends IBasePerTenantAndOrganizationEntityModel {
	// OAuth credentials and parameters
	oauthParams: {
		client_id: string;
		code: string;
		grant_type: GrantType;
		redirect_uri: string;
		client_secret: string;
	};
}

export interface IMakeComOAuthCodeExchange {
	code: string;
	state?: string;
}
