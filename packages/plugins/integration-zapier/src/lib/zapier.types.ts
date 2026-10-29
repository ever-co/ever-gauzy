import { IBasePerTenantAndOrganizationEntityModel, IntegrationEnum, ITimeLog } from '@gauzy/contracts';

export type ZapierGrantType = 'authorization_code' | 'refresh_token';
export type ActionType = 'start' | 'stop';

export interface IZapierAccessTokens {
	access_token: string;
	refresh_token: string;
	token_type: string;
	expires_in: number;
}

export interface ICreateZapierIntegrationInput extends IBasePerTenantAndOrganizationEntityModel {
	code?: string;
	redirect_uri?: string;
	state?: string;
}

export interface ITimerZapierWebhookData extends IBasePerTenantAndOrganizationEntityModel {
	event: string;
	action: ActionType;
	data: ITimeLog;
}

export interface IZapierEndpoint {
	id: string;
	name: string;
	description?: string;
	slug: string;
}

export interface IIntegrationFilter {
	readonly name: IntegrationEnum.ZAPIER;
	tenantId: string;
	organizationId?: string;
}

export interface IZapierCreateWebhookInput {
	target_url: string;
	event: string;
}

export interface IZapierIntegrationSettings {
	isEnabled: boolean;
	hasClientCredentials: boolean;
	hasAccessToken: boolean;
	hasRefreshToken: boolean;
	/** The webhook URL saved with `PUT /integration/zapier/settings`, or null. */
	webhookUrl?: string | null;
}

/** The body of `PUT /integration/zapier/settings`. */
export interface IZapierUpdateSettingsInput {
	isEnabled: boolean;
	/** An empty string or null clears it. */
	webhookUrl?: string | null;
}

/**
 * The Zapier OAuth configuration the web app may see (`GET /integration/zapier/oauth/config`): never the client secret.
 * A value the server does not configure is null.
 */
export interface IZapierOAuthPublicConfig {
	clientId: string | null;
	redirectUri: string | null;
	postInstallUrl: string | null;
	scopes: string[];
}
