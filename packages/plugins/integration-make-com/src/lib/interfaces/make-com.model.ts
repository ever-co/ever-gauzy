import { IBasePerTenantAndOrganizationEntityModel, IntegrationEnum } from '@gauzy/contracts';

export type GrantType = 'authorization_code' | 'refresh_token';

// Define Make.com integration setting names
export enum MakeSettingName {
	IS_ENABLED = 'make_webhook_enabled',
	WEBHOOK_URL = 'make_webhook_url',
	ACCESS_TOKEN = 'access_token',
	REFRESH_TOKEN = 'refresh_token',
	EXPIRES_IN = 'expires_in',
	EXPIRES_AT = 'expires_at',
	TOKEN_TYPE = 'token_type',
	CLIENT_ID = 'client_id',
	CLIENT_SECRET = 'client_secret',
	AUTH_CODE = 'auth_code',
	/** The Make.com zone for API calls, e.g. "us2", "eu1" */
	ZONE = 'make_zone',
	/** The Make.com organization ID (their side, not Gauzy) */
	MAKE_ORGANIZATION_ID = 'make_organization_id',
	/** The Make.com team ID (their side, not Gauzy) */
	MAKE_TEAM_ID = 'make_team_id',
}

// Define the return type for the settings
export interface IMakeComIntegrationSettings {
	isEnabled: boolean;
	webhookUrl: string | null;
}

// Integration filter interface
export interface IIntegrationFilter {
	name: IntegrationEnum.MakeCom;
	tenantId: string;
	organizationId?: string;
}

/**
 * Pure DTO representing Make.com OAuth token response
 */
export interface IMakeComOAuthTokenDTO {
	access_token: string;
	refresh_token: string;
	token_type: string;
	expires_in: number;
}

/**
 * Persistence model combining token data with organizational metadata
 */
export interface IMakeComOAuthTokens extends IBasePerTenantAndOrganizationEntityModel, IMakeComOAuthTokenDTO {}

export interface IMakeComAuthConfig {
	clientId: string;
	clientSecret: string;
	redirectUri: string;
	postInstallUrl: string;
}

export interface IMakeComCreateIntegration extends IBasePerTenantAndOrganizationEntityModel {}

export interface IMakeComOAuthCodeExchange {
	code: string;
	state: string; // CSRF protection
}
