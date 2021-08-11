import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface IOrganizationAward extends IOrganizationAwardCreateInput {
	id?: string;
}

export interface IOrganizationAwardFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
	year?: string;
}

export interface IOrganizationAwardCreateInput
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	year: string;
}
