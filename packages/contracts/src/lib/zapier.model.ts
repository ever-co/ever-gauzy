import { IBasePerTenantAndOrganizationEntityModel } from "./base-entity.model";

export interface IZapierAccessTokens {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
}

export type ZapierGrantType = 'authorization_code' | 'refresh_token';

export interface ICreateZapierIntegrationInput extends IBasePerTenantAndOrganizationEntityModel {
    client_id: string;
    code: string;
    grant_type: ZapierGrantType;
    redirect_uri: string;
    client_secret: string;
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
