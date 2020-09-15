import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface IOrganizationAwards
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	year: string;
}

export interface IOrganizationAwardsFindInput {
	name?: string;
	organizationId?: string;
	year?: string;
}

export interface IOrganizationAwardsCreateInput {
	name: string;
	organizationId: string;
	year: string;
}
