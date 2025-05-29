import { IBasePerTenantAndOrganizationEntityModel, ITimeLog } from '@gauzy/contracts';

export type ZapierGrantType = 'authorization_code' | 'refresh_token';
export type ActionType = 'start' | 'stop';

export interface IZapierAccessTokens {
	access_token: string;
	refresh_token: string;
	token_type: string;
	expires_in: number;
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

export interface IZapierEndpoint {
	id: string;
	name: string;
	description?: string;
	slug: string;
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
