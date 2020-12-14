import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface IOrganizationAwards extends IOrganizationAwardsCreateInput {
	id?: string;
}

export interface IOrganizationAwardsFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
	year?: string;
}

export interface IOrganizationAwardsCreateInput
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	year: string;
}
