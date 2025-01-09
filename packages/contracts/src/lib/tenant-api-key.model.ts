import { IBasePerTenantEntityModel } from './base-entity.model';

export interface ITenantApiKey extends IBasePerTenantEntityModel {
	name: string;
	apiKey: string;
	apiSecret: string;
}

export interface ITenantApiKeyCreateInput extends ITenantApiKey {}
