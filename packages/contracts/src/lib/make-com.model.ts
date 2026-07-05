import { IBasePerTenantAndOrganizationEntityModel } from '@gauzy/contracts';

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
	AUTH_CODE = 'auth_code'
}

// Define the return type for the settings
export interface IMakeComIntegrationSettings {
	isEnabled: boolean;
	webhookUrl: string | null;
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

// Make.com API Resource Types

export type MakeComZone = 'eu1' | 'eu2' | 'us1' | 'us2';

export const MAKE_COM_ZONES: MakeComZone[] = ['eu1', 'eu2', 'us1', 'us2'];

export interface IMakeComOrganization {
	id: number;
	name: string;
	countryId?: number;
	timezoneId?: number;
	license?: string;
	zone?: MakeComZone;
}

export interface IMakeComTeam {
	id: number;
	name: string;
	organizationId: number;
}

export interface IMakeComConnection {
	id: number;
	name: string;
	accountName?: string;
	accountLabel?: string;
	accountType?: string;
	packageName?: string;
	expire?: string;
	metadata?: Record<string, unknown>;
	teamId?: number;
	upgradeable?: boolean;
	scoped?: boolean;
	editable?: boolean;
}

export interface IMakeComScenario {
	id: number;
	name: string;
	teamId: number;
	hookId?: number;
	description?: string;
	folderId?: number;
	isEnabled?: boolean;
	isPaused?: boolean;
	usedPackages?: string[];
	lastEdit?: string;
	scheduling?: IMakeComScenarioScheduling;
	islinked?: boolean;
	isinvalid?: boolean;
	islocked?: boolean;
	createdByUser?: { id: number; name: string; email: string };
	updatedByUser?: { id: number; name: string; email: string };
}

export interface IMakeComScenarioScheduling {
	type: string;
	interval?: number;
}

export interface IMakeComHook {
	id: number;
	name: string;
	teamId: number;
	url?: string;
	type?: string;
	typeName?: string;
	packageName?: string;
	theme?: string;
	enabled?: boolean;
	data?: Record<string, unknown>;
	queueCount?: number;
	queueLimit?: number;
}

export interface IMakeComTemplate {
	id: number;
	name: string;
	description?: string;
	usedPackages?: string[];
	public?: boolean;
	publishedDate?: string;
	teamId?: number;
}

export interface IMakeComSetupStatus {
	hasAccessToken: boolean;
	zone: MakeComZone | null;
	makeOrganizationId: number | null;
	makeTeamId: number | null;
	isComplete: boolean;
}
