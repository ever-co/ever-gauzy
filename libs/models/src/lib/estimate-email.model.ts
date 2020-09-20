import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface IEstimateEmail
	extends IBasePerTenantAndOrganizationEntityModel {
	token?: string;
	email?: string;
	expireDate?: Date;
}

export interface IEstimateEmailFindInput {
	token?: string;
	email?: string;
}
