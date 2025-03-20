import { IBasePerTenantAndOrganizationEntityModel } from "./base-entity.model";

export interface IZapierAccessTokens {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
}

export interface ICreateZapierIntegrationInput extends IBasePerTenantAndOrganizationEntityModel {
    client_id: string;
    code: string;
    grant_type: string;
    redirect_uri: string;
    client_secret: string;
}

export interface IZapierTrigger {
    id: string;
    name: string;
    description: string;
}

export interface IZapierAction {
    id: string;
    name: string;
    description: string;
}
