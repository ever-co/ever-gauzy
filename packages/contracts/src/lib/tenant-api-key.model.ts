import { IBasePerTenantEntityModel } from './base-entity.model';

export interface ITenantApiKey extends IBasePerTenantEntityModel {
	apiKey: string;
	apiSecret: string;
	openAiSecretKey?: string;
	openAiOrganizationId?: string;
}

export interface ITenantApiKeyCreateInput extends ITenantApiKey {}
