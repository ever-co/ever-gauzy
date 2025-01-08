import { IBasePerTenantEntityModel } from './base-entity.model';

export interface ITenantApiKey extends IBasePerTenantEntityModel {
	apiKey: string;
	apiSecret: string;
}

export interface ITenantApiKeyCreateInput extends ITenantApiKey {}
