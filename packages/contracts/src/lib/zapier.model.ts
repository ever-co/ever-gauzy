import { IBasePerTenantAndOrganizationEntityModel, ITimeLog } from '@gauzy/contracts';

export type ZapierGrantType = 'authorization_code' | 'refresh_token';
export type ActionType = 'start' | 'stop';

// Define Zapier integration setting names
export enum ZapierSettingName {
	IS_ENABLED = 'zapier_webhook_enabled',
	WEBHOOK_URL = 'zapier_webhook_url',
	ACCESS_TOKEN = 'access_token',
	REFRESH_TOKEN = 'refresh_token',
	EXPIRES_IN = 'expires_in',
	EXPIRES_AT = 'expires_at',
	TOKEN_TYPE = 'token_type',
	CLIENT_ID = 'client_id',
	CLIENT_SECRET = 'client_secret',
	AUTH_CODE = 'auth_code'
}

// Define the return type for the settings
export interface IZapierIntegrationSettings {
	isEnabled: boolean;
	webhookUrl: string | null;
}

/**
 * Pure DTO representing Zapier OAuth token response
 */
export interface IZapierOAuthTokenDTO {
	access_token: string;
	refresh_token: string;
	token_type: string;
	expires_in: number;
}

/**
 * Persistence model combining token data with organizational metadata
 */
export interface IZapierOAuthTokens extends IBasePerTenantAndOrganizationEntityModel, IZapierOAuthTokenDTO {}

export interface IZapierAuthConfig {
	clientId: string;
	clientSecret: string;
	redirectUri: string;
	postInstallUrl: string;
}

export interface IZapierCreateIntegration extends IBasePerTenantAndOrganizationEntityModel {
	clientId: string;
	clientSecret: string;
}

export interface IZapierOAuthCodeExchange {
	code: string;
	state: string; // CSRF protection
}

export interface IZapierEndpoint {
	id: string;
	name: string;
	description?: string;
	slug: string;
}

export interface ICreateZapierIntegrationInput extends IBasePerTenantAndOrganizationEntityModel {
	client_id: string;
	client_secret: string;
	code?: string;
	redirect_uri?: string;
}

export interface ITimerZapierWebhookData extends IBasePerTenantAndOrganizationEntityModel {
	event: string;
	action: ActionType;
	data: ITimeLog;
}

export interface IZapierCreateWebhookInput {
	target_url: string;
	event: string;
}

/**
 * Interface for OAuth state data structure used in Zapier OAuth flow
 * Contains tenant and organization context for maintaining state during OAuth
 */
export interface IZapierAuthState {
	tenantId: string;
	organizationId?: string;
	integrationId?: string;
}

/**
 * Interface representing a Zapier webhook subscription
 */
export interface IZapierWebhook extends IBasePerTenantAndOrganizationEntityModel {
	id: string;
	targetUrl: string;
	event: string;
	integrationId: string;
	createdAt: Date;
	updatedAt: Date;
}
