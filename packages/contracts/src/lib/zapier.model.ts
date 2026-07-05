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

/**
 * Represents a single step in a Zapier Zap (trigger or action).
 * See https://docs.zapier.com/powered-by-zapier/api-reference/zaps/create-a-zap
 */
export interface IZapierZapStep {
	/** Fully-qualified action identifier, e.g. "example_core:Vn7xbE60" */
	action: string;
	/** Authentication ID to use for this step, or null */
	authentication?: string | null;
	/** Input field values for this step */
	inputs?: Record<string, any> | null;
	/** Optional user-facing title for this step */
	title?: string | null;
}

/**
 * Links returned alongside a Zap, such as a direct link to the Zap editor.
 */
export interface IZapierZapLinks {
	html_editor?: string;
}

/**
 * Represents a Zapier Zap.
 * See https://docs.zapier.com/powered-by-zapier/api-reference/zaps/get-zaps-[v2]
 * and https://docs.zapier.com/powered-by-zapier/api-reference/zaps/create-a-zap
 */
export interface IZapierZap {
	type?: 'zap';
	id: string;
	title: string;
	is_enabled?: boolean;
	last_successful_run_date?: string | null;
	updated_at?: string;
	links?: IZapierZapLinks;
	steps?: IZapierZapStep[];

	// Fields returned by the list endpoint (GET /v2/zaps)
	state?: string;
	url?: string;
	create_time?: string;
	modified_time?: string;
}

/**
 * Input for creating a new Zap via the Zapier Partner API.
 * See https://docs.zapier.com/powered-by-zapier/api-reference/zaps/create-a-zap
 */
export interface IZapierCreateZapInput {
	title: string;
	steps: IZapierZapStep[];
}

/**
 * Represents a Zapier Zap template.
 * See https://docs.zapier.com/powered-by-zapier/api-reference/zap-templates/get-zap-templates
 */
export interface IZapierZapTemplate {
	id: string;
	title: string;
	description?: string;
	url?: string;
	create_url?: string;
}

export interface ICreateZapierIntegrationInput extends IBasePerTenantAndOrganizationEntityModel {
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
