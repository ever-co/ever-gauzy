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
	code: string;
	grant_type: ZapierGrantType;
	redirect_uri: string;
	client_secret: string;
}

export interface ITimerZapierWebhookData extends IBasePerTenantAndOrganizationEntityModel {
	event: string;
	action: ActionType;
	data: ITimeLog;
}

export interface IZapierEndpoint {
	id: string;
	name: string;
	description: string;
}

export interface IZapierCreateWebhookInput {
	target_url: string;
	event: string;
}
